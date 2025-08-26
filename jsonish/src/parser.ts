import { z } from 'zod';
import { Value, createStringValue, createValueFromParsed } from './value.js';
import { coerceToString, coerceToNumber, coerceToBoolean, extractFromText, isSchemaType } from './coercer.js';
import { fixJson, parseWithAdvancedFixing } from './fixing-parser.js';
import { extractJsonFromText, extractMultipleObjects } from './extractors.js';

export function parseBasic<T extends z.ZodType>(input: string, schema: T): z.infer<T> {
  const ctx = createParsingContext();
  
  // String Schema Priority: Always return raw input when targeting string
  if (schema instanceof z.ZodString) {
    return schema.parse(input) as z.infer<T>;
  }
  
  // Strategy 1: Standard JSON parsing
  try {
    const parsed = JSON.parse(input);
    const value = createValueFromParsed(parsed);
    return coerceValue(value, schema, ctx);
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
            coerceValue(obj, schema.element, createParsingContext());
            return true;
          } catch {
            return false;
          }
        });
        
        if (validObjects.length > 0) {
          try {
            const arrayValue = { type: 'array' as const, items: validObjects, completion: 'Complete' as const };
            return coerceValue(arrayValue, schema, ctx);
          } catch {
            // Continue to single object extraction
          }
        }
      }
    }
    
    const extractedValues = extractJsonFromText(input);
    for (const value of extractedValues) {
      try {
        return coerceValue(value, schema, createParsingContext());
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
      return coerceValue(value, schema, ctx);
    }
  } catch {
    // Continue to other strategies
  }
  
  // Strategy 4: Advanced state machine parsing for complex malformed JSON
  if (schema instanceof z.ZodObject || schema instanceof z.ZodArray) {
    try {
      const { value } = parseWithAdvancedFixing(input);
      return coerceValue(value, schema, ctx);
    } catch {
      // Continue to other strategies
    }
  }
  
  // Strategy 5: Extract from text based on schema type
  try {
    const extractedValue = extractFromText(input, schema);
    if (extractedValue) {
      return coerceValue(extractedValue, schema, ctx);
    }
  } catch (error) {
    // If extraction fails (e.g., ambiguous boolean), re-throw
    throw error;
  }
  
  // Strategy 6: String fallback with type coercion
  const stringValue = createStringValue(input);
  return coerceValue(stringValue, schema, ctx);
}

// Parsing context for circular reference detection
interface ParsingContext {
  visitedClassValuePairs: Set<string>;
  depth: number;
  maxDepth: number;
}

function createParsingContext(): ParsingContext {
  return {
    visitedClassValuePairs: new Set(),
    depth: 0,
    maxDepth: 100
  };
}

function coerceValue<T extends z.ZodType>(value: Value, schema: T, ctx: ParsingContext = createParsingContext()): z.infer<T> {
  // Handle z.lazy() schemas for recursive types
  if (schema instanceof z.ZodLazy) {
    const resolvedSchema = schema._def.getter();
    return coerceValue(value, resolvedSchema, ctx) as z.infer<T>;
  }
  
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
  
  if (schema instanceof z.ZodUnion) {
    return coerceUnion(value, schema, ctx) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodArray) {
    return coerceArray(value, schema, ctx) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodObject) {
    return coerceObject(value, schema, ctx) as z.infer<T>;
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

interface FieldMatchResult {
  schemaKey: string;
  matchType: 'exact' | 'trimmed' | 'case-insensitive' | 'alias';
  confidence: number;
}

function findBestFieldMatch(inputKey: string, schemaKeys: string[]): FieldMatchResult | null {
  // 1. Exact match
  if (schemaKeys.includes(inputKey)) {
    return { schemaKey: inputKey, matchType: 'exact', confidence: 1.0 };
  }
  
  // 2. Trimmed match
  const trimmedKey = inputKey.trim();
  if (schemaKeys.includes(trimmedKey)) {
    return { schemaKey: trimmedKey, matchType: 'trimmed', confidence: 0.9 };
  }
  
  // 3. Case-insensitive match
  const lowerKey = inputKey.toLowerCase();
  const caseMatch = schemaKeys.find(k => k.toLowerCase() === lowerKey);
  if (caseMatch) {
    return { schemaKey: caseMatch, matchType: 'case-insensitive', confidence: 0.8 };
  }
  
  // 4. Alias matching (kebab-case, snake_case, etc.)
  const aliasMatch = findAliasMatch(inputKey, schemaKeys);
  if (aliasMatch) {
    return { schemaKey: aliasMatch, matchType: 'alias', confidence: 0.7 };
  }
  
  return null;
}

function findAliasMatch(inputKey: string, schemaKeys: string[]): string | null {
  // Convert input key to different formats and check for matches
  const normalized = inputKey.toLowerCase().trim();
  
  for (const schemaKey of schemaKeys) {
    const schemaKeyNormalized = schemaKey.toLowerCase();
    
    // Check if they match when converted to different naming conventions
    const variations = [
      normalized.replace(/[-_\s]/g, ''), // remove separators
      normalized.replace(/[-\s]/g, '_'), // kebab/space to snake_case
      normalized.replace(/[_\s]/g, '-'), // snake/space to kebab-case
      normalized.replace(/[-_]/g, ''), // remove all separators
    ];
    
    const schemaVariations = [
      schemaKeyNormalized.replace(/[-_\s]/g, ''), // remove separators
      schemaKeyNormalized.replace(/[-\s]/g, '_'), // kebab/space to snake_case
      schemaKeyNormalized.replace(/[_\s]/g, '-'), // snake/space to kebab-case
      schemaKeyNormalized.replace(/[-_]/g, ''), // remove all separators
    ];
    
    // Check if any variation of input matches any variation of schema key
    for (const inputVar of variations) {
      for (const schemaVar of schemaVariations) {
        if (inputVar === schemaVar && inputVar.length > 0) {
          return schemaKey;
        }
      }
    }
  }
  
  return null;
}

function coerceObject<T extends z.ZodObject<any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  const schemaShape = schema.shape as Record<string, z.ZodType>;
  const schemaKeys = Object.keys(schemaShape);
  
  // Generate unique key for circular reference detection
  const valueKey = JSON.stringify([schemaKeys, coerceValueGeneric(value)]);
  if (ctx.visitedClassValuePairs.has(valueKey)) {
    throw new Error('Circular reference detected');
  }
  
  const newCtx = {
    ...ctx,
    visitedClassValuePairs: new Set([...ctx.visitedClassValuePairs, valueKey]),
    depth: ctx.depth + 1
  };
  
  if (newCtx.depth > newCtx.maxDepth) {
    throw new Error('Maximum recursion depth exceeded');
  }
  
  if (value.type === 'object') {
    const obj: Record<string, any> = {};
    
    // Initialize optional fields to undefined
    for (const [schemaKey, schemaField] of Object.entries(schemaShape)) {
      const isOptional = schemaField instanceof z.ZodOptional || 
                        (schemaField instanceof z.ZodNullable && schemaField._def.innerType instanceof z.ZodOptional);
      if (isOptional) {
        obj[schemaKey] = undefined;
      }
    }
    
    // Process object fields
    for (const [key, val] of value.entries) {
      let fieldSchema = schemaShape[key];
      let targetKey = key;
      
      // If no exact match, try different matching strategies
      if (!fieldSchema) {
        const matchResult = findBestFieldMatch(key, schemaKeys);
        if (matchResult) {
          fieldSchema = schemaShape[matchResult.schemaKey];
          targetKey = matchResult.schemaKey;
        }
      }
      
      // If we found a matching schema, use it
      if (fieldSchema) {
        obj[targetKey] = coerceValue(val, fieldSchema, newCtx);
      }
    }
    
    return schema.parse(obj) as z.infer<T>;
  }
  
  // Single value to object coercion for single-field schemas (following Rust pattern)
  if (schemaKeys.length === 1) {
    const [fieldKey] = schemaKeys;
    const fieldSchema = schemaShape[fieldKey];
    
    try {
      const coercedValue = coerceValue(value, fieldSchema, newCtx);
      const obj = { [fieldKey]: coercedValue };
      return schema.parse(obj) as z.infer<T>;
    } catch {
      // Fall through to generic coercion
    }
  }
  
  // Fallback to generic coercion
  return schema.parse(coerceValueGeneric(value)) as z.infer<T>;
}

function coerceArray<T extends z.ZodArray<any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  const newCtx = { ...ctx, depth: ctx.depth + 1 };
  
  if (newCtx.depth > newCtx.maxDepth) {
    throw new Error('Maximum recursion depth exceeded');
  }
  
  if (value.type === 'array') {
    // Check if element schema expects union objects with wrapper fields (following Rust union wrapping pattern)
    if (schema.element instanceof z.ZodObject) {
      const elementShape = schema.element.shape as Record<string, z.ZodType>;
      
      // Look for union wrapper patterns (e.g., "selected" field with union type)
      for (const [key, fieldSchema] of Object.entries(elementShape)) {
        if (fieldSchema instanceof z.ZodUnion) {
          // Try wrapping each array item in the union field
          const wrappedItems = [];
          let allWrappingSucceeded = true;
          
          for (const item of value.items) {
            if (item.type === 'object') {
              // Try to coerce the object to match one of the union options
              const unionOptions = fieldSchema._def.options;
              let matchedOption = null;
              
              for (const option of unionOptions) {
                try {
                  const coercedItem = coerceValue(item, option, newCtx);
                  matchedOption = coercedItem;
                  break;
                } catch {
                  continue;
                }
              }
              
              if (matchedOption !== null) {
                const wrappedObj = { [key]: matchedOption };
                wrappedItems.push(wrappedObj);
              } else {
                allWrappingSucceeded = false;
                break;
              }
            } else {
              allWrappingSucceeded = false;
              break;
            }
          }
          
          if (allWrappingSucceeded && wrappedItems.length > 0) {
            return schema.parse(wrappedItems) as z.infer<T>;
          }
        }
      }
    }
    
    // Standard array coercion
    const items = value.items.map(item => coerceValue(item, schema.element, newCtx));
    return schema.parse(items) as z.infer<T>;
  }
  
  // Single value to array wrapping
  const coerced = coerceValue(value, schema.element, newCtx);
  return schema.parse([coerced]) as z.infer<T>;
}

function coerceUnion<T extends z.ZodUnion<any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  const options = schema._def.options;
  
  // Try all union options and pick the best match (following Rust best-match pattern)
  const results = [];
  for (const option of options) {
    try {
      const result = coerceValue(value, option, ctx);
      results.push({ result, option });
    } catch {
      continue;
    }
  }
  
  if (results.length === 0) {
    throw new Error(`No union option matched value: ${JSON.stringify(coerceValueGeneric(value))}`);
  }
  
  // For now, return the first successful result
  // TODO: Implement scoring system like in Rust version
  return results[0].result as z.infer<T>;
}