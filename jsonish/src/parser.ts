import { z } from 'zod';
import { Value, createStringValue, createValueFromParsed } from './value.js';
import { coerceToString, coerceToNumber, coerceToBoolean, extractFromText, isSchemaType } from './coercer.js';
import { fixJson, parseWithAdvancedFixing } from './fixing-parser.js';
import { extractJsonFromText, extractMultipleObjects } from './extractors.js';

export function parseBasic<T extends z.ZodType>(input: string, schema: T): z.infer<T> {
  // String Schema Priority: Always return raw input when targeting string
  if (schema instanceof z.ZodString) {
    return schema.parse(input) as z.infer<T>;
  }
  
  // Strategy 1: Standard JSON parsing
  try {
    const parsed = JSON.parse(input);
    const value = createValueFromParsed(parsed);
    return coerceValue(value, schema);
  } catch {
    // Continue to other strategies
  }
  
  // Strategy 2: Extract JSON from mixed content (for complex types)
  if (schema instanceof z.ZodObject || schema instanceof z.ZodArray) {
    // For array schemas, try to collect multiple objects first
    if (schema instanceof z.ZodArray) {
      const multipleObjects = extractMultipleObjects(input);
      if (multipleObjects.length > 1) {
        // Filter objects that can be coerced to match the element schema
        const validObjects = multipleObjects.filter(obj => {
          try {
            coerceValue(obj, schema.element);
            return true;
          } catch {
            return false;
          }
        });
        
        if (validObjects.length > 0) {
          try {
            const arrayValue = { type: 'array' as const, items: validObjects, completion: 'Complete' as const };
            return coerceValue(arrayValue, schema);
          } catch {
            // Continue to single object extraction
          }
        }
      }
    }
    
    const extractedValues = extractJsonFromText(input);
    for (const value of extractedValues) {
      try {
        return coerceValue(value, schema);
      } catch {
        continue;
      }
    }
  }
  
  // Strategy 3: JSON fixing for malformed input
  try {
    const fixed = fixJson(input);
    if (fixed !== input) {
      const parsed = JSON.parse(fixed);
      const value = createValueFromParsed(parsed);
      return coerceValue(value, schema);
    }
  } catch {
    // Continue to other strategies
  }
  
  // Strategy 4: Advanced state machine parsing for complex malformed JSON
  if (schema instanceof z.ZodObject || schema instanceof z.ZodArray) {
    try {
      const { value } = parseWithAdvancedFixing(input);
      return coerceValue(value, schema);
    } catch {
      // Continue to other strategies
    }
  }
  
  // Strategy 5: Extract from text based on schema type
  try {
    const extractedValue = extractFromText(input, schema);
    if (extractedValue) {
      return coerceValue(extractedValue, schema);
    }
  } catch (error) {
    // If extraction fails (e.g., ambiguous boolean), re-throw
    throw error;
  }
  
  // Strategy 6: String fallback with type coercion
  const stringValue = createStringValue(input);
  return coerceValue(stringValue, schema);
}

function coerceValue<T extends z.ZodType>(value: Value, schema: T): z.infer<T> {
  // Handle specific schema types with proper coercion
  if (schema instanceof z.ZodString) {
    return coerceToString(value, schema) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodNumber) {
    return coerceToNumber(value, schema) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodBoolean) {
    return coerceToBoolean(value, schema) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodNull) {
    return schema.parse(null) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodArray) {
    if (value.type === 'array') {
      const items = value.items.map(item => coerceValue(item, schema.element));
      return schema.parse(items) as z.infer<T>;
    }
    
    // Single value to array wrapping
    const coerced = coerceValue(value, schema.element);
    return schema.parse([coerced]) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodObject) {
    if (value.type === 'object') {
      const obj: Record<string, any> = {};
      const schemaShape = schema.shape as Record<string, z.ZodType>;
      
      // First, set default values for optional fields
      for (const [schemaKey, schemaField] of Object.entries(schemaShape)) {
        // Check if field is optional (can be ZodOptional or nested in ZodNullable)
        const isOptional = schemaField instanceof z.ZodOptional || 
                          (schemaField instanceof z.ZodNullable && schemaField._def.innerType instanceof z.ZodOptional);
        if (isOptional) {
          obj[schemaKey] = undefined;
        }
      }
      
      for (const [key, val] of value.entries) {
        // Try exact match first
        let fieldSchema = schemaShape[key];
        let targetKey = key;
        
        // If no exact match, try trimmed key
        if (!fieldSchema && key.trim() !== key) {
          const trimmedKey = key.trim();
          fieldSchema = schemaShape[trimmedKey];
          if (fieldSchema) {
            targetKey = trimmedKey;
          }
        }
        
        // If we found a matching schema, use it
        if (fieldSchema) {
          obj[targetKey] = coerceValue(val, fieldSchema);
        }
      }
      return schema.parse(obj) as z.infer<T>;
    }
  }
  
  // Generic fallback
  return schema.parse(coerceValueGeneric(value)) as z.infer<T>;
}

function coerceValueGeneric(value: Value): any {
  switch (value.type) {
    case 'string':
      return value.value;
    case 'number':
      return value.value;
    case 'boolean':
      return value.value;
    case 'null':
      return null;
    case 'array':
      return value.items.map(coerceValueGeneric);
    case 'object':
      const obj: Record<string, any> = {};
      for (const [key, val] of value.entries) {
        obj[key] = coerceValueGeneric(val);
      }
      return obj;
    default:
      throw new Error(`Cannot coerce ${value.type} generically`);
  }
}