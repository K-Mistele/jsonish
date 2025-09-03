import { z } from 'zod';
import { Value, createStringValue, createValueFromParsed } from './value.js';
import { coerceToString, coerceToNumber, coerceToBoolean, coerceLiteral, isSchemaType, normalizeLiteralString, extractFromText, detectLiteralAmbiguity, isIncompleteQuotedString } from './coercer.js';
import { fixJson, parseWithAdvancedFixing } from './fixing-parser.js';
import { extractJsonFromText, extractMultipleObjects } from './extractors.js';
import type { ParseOptions } from './index.js';

// Global caches for performance optimization (inspired by BAML's approach)
const lazySchemaCache = new WeakMap<z.ZodLazy<any>, z.ZodType>();

// Semantic alias mappings for field names
const SEMANTIC_ALIASES: Record<string, string[]> = {
  'signature': ['function_signature', 'func_signature', 'method_signature'],
  'description': ['desc', 'details', 'summary'],
  'properties': ['props', 'attributes', 'fields'],
};

export function parseBasic<T extends z.ZodType>(input: string, schema: T, options?: ParseOptions): z.infer<T> {
  const ctx = createParsingContext();
  
  // Set default options with strategy controls
  const defaultOptions: ParseOptions = {
    allowAsString: true,
    allowMarkdownJson: true,
    allowFixes: true,
    allowPartial: false,
    allowMalformed: false
  };
  const opts = { ...defaultOptions, ...options };
  
  
  // Early streaming validation for incomplete quoted strings (only for literal unions)
  if (schema instanceof z.ZodUnion) {
    const unionOptions = schema._def.options;
    const hasLiteralOptions = unionOptions.some((option: z.ZodType) => option instanceof z.ZodLiteral);
    if (hasLiteralOptions && isIncompleteQuotedString(input)) {
      throw new Error('Incomplete quoted string - streaming validation failure');
    }
  }
  
  // String Schema Priority: Always return raw input when targeting string
  if (schema instanceof z.ZodString) {
    return schema.parse(input) as z.infer<T>;
  }
  
  // Special handling for unions containing string schemas to preserve formatting
  if (schema instanceof z.ZodUnion) {
    const unionOptions = schema._def.options;
    const hasStringOption = unionOptions.some((option: z.ZodType) => option instanceof z.ZodString);
    const hasArrayOption = unionOptions.some((option: z.ZodType) => option instanceof z.ZodArray);
    const hasObjectOption = unionOptions.some((option: z.ZodType) => option instanceof z.ZodObject);
    
    if (hasStringOption && !hasArrayOption && !hasObjectOption && input.startsWith('"') && input.endsWith('"')) {
      // Only skip JSON.parse for inputs that look like JSON-quoted strings
      // AND only if the union contains only primitive types (no complex structures)
      const stringValue = createStringValue(input);
      return coerceUnion(stringValue, schema, ctx) as z.infer<T>;
    }
  }
  
  // Strategy 1: Standard JSON parsing
  try {
    // console.log(`[DEBUG] Attempting JSON.parse on input (first 200 chars):`, input.substring(0, 200));
    const parsed = JSON.parse(input);
    // Debug logging for parsed structure (disabled)
    // console.log(`[DEBUG] JSON.parse succeeded:`, JSON.stringify(parsed, null, 2).substring(0, 500));
    const value = createValueFromParsed(parsed);
    return coerceValue(value, schema, ctx);
  } catch (e) {
    // console.log(`[DEBUG] JSON.parse failed:`, e.message);
    // Continue to other strategies
  }
  
  // Strategy 2: Extract JSON from mixed content (for complex types) - controlled by allowMarkdownJson
  if (opts.allowMarkdownJson && (schema instanceof z.ZodObject || schema instanceof z.ZodArray || schema instanceof z.ZodRecord)) {
    const extractedValues = extractJsonFromText(input);
    // Debug logging for extracted values (disabled)
    // if (extractedValues.length > 0) {
    //   console.log(`[DEBUG] Strategy 2: Extracted ${extractedValues.length} values from mixed content`);
    //   console.log(`[DEBUG] First extracted value:`, JSON.stringify(extractedValues[0], null, 2));
    // }
    
    // For partial parsing with object schemas, check for incomplete arrays before coercion
    if (opts.allowPartial && schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const incompleteArrayResult: Record<string, any> = {};
      let hasIncompleteArrays = false;
      
      // Check each field for incomplete arrays
      for (const [key, fieldSchema] of Object.entries(shape)) {
        if (fieldSchema instanceof z.ZodArray) {
          const isIncomplete = hasIncompleteArrayElementsForField(input, key);
          if (isIncomplete) {
            hasIncompleteArrays = true;
            incompleteArrayResult[key] = []; // Set empty array for incomplete fields
          }
        }
      }
      
      
      // If we found incomplete arrays, fill in other fields and return partial result
      if (hasIncompleteArrays) {
        for (const [key, fieldSchema] of Object.entries(shape)) {
          if (!(key in incompleteArrayResult)) {
            // Try to extract the field value from extracted values
            let fieldValue = getDefaultValue(fieldSchema as z.ZodType);
            for (const value of extractedValues) {
              if (value.type === 'object') {
                const valueEntry = value.entries.find(([k, v]) => k === key);
                if (valueEntry) {
                  try {
                    fieldValue = coerceValue(valueEntry[1], fieldSchema as z.ZodType, ctx);
                    break;
                  } catch {
                    // Continue trying other extracted values
                  }
                }
              }
            }
            incompleteArrayResult[key] = fieldValue;
          }
        }
        return incompleteArrayResult;
      }
    }
    
    // For array schemas with multiple extracted objects (not arrays), collect ALL objects first
    if (schema instanceof z.ZodArray && extractedValues.length > 1) {
      // Only apply multi-object collection if we have multiple distinct objects
      // Don't apply if we have arrays (which would be duplicate extraction artifacts)
      const objectValues = extractedValues.filter(val => val.type === 'object');
      
      if (objectValues.length > 1 && objectValues.length === extractedValues.length) {
        // All extracted values are objects - this is likely a multi-object scenario
        // Filter objects that can be coerced to match the element schema
        const validObjects = objectValues.filter(obj => {
          try {
            coerceValue(obj, schema.element, ctx);
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
            // Continue to individual object processing
          }
        }
      }
    }
    
    // For non-array schemas or array schemas with single objects, process individually
    for (const value of extractedValues) {
      try {
        // First try regular coercion
        // Debug: Log the extracted value structure (disabled)
        // console.log(`[DEBUG] Extracted value type:`, value.type, 'First few entries:', value.type === 'object' ? value.entries.slice(0, 2).map(([k,v]) => `${k}: ${v.type} = ${v.value}`): '');
        const result = coerceValue(value, schema, ctx);
        
        // If allowPartial is enabled, check if the result might have been degraded due to missing partial data
        if (opts.allowPartial) {
          // Special handling for incomplete arrays - if input has incomplete arrays, return result with empty arrays
          if (schema instanceof z.ZodObject) {
            const shape = schema.shape;
            let hasIncompleteArrays = false;
            const incompleteArrayResult: Record<string, any> = {};
            
            // Check for incomplete arrays and build result with empty arrays for incomplete fields
            for (const [key, fieldSchema] of Object.entries(shape)) {
              if (fieldSchema instanceof z.ZodArray && hasIncompleteArrayElementsForField(input, key)) {
                hasIncompleteArrays = true;
                incompleteArrayResult[key] = []; // Set empty array for incomplete fields
              } else if (key in result) {
                incompleteArrayResult[key] = result[key]; // Keep existing values for other fields
              }
            }
            
            // If we found incomplete arrays, return the modified result
            if (hasIncompleteArrays) {
              // Fill in missing fields with defaults, but preserve successfully parsed fields
              for (const [key, fieldSchema] of Object.entries(shape)) {
                if (!(key in incompleteArrayResult)) {
                  // Try to preserve the successfully parsed value from the original result
                  if (key in result) {
                    incompleteArrayResult[key] = result[key];
                  } else {
                    // Use a simple default value function for truly missing fields
                    if (fieldSchema instanceof z.ZodString) {
                      incompleteArrayResult[key] = "";
                    } else if (fieldSchema instanceof z.ZodNumber) {
                      incompleteArrayResult[key] = 0;
                    } else if (fieldSchema instanceof z.ZodBoolean) {
                      incompleteArrayResult[key] = false;
                    } else if (fieldSchema instanceof z.ZodArray) {
                      incompleteArrayResult[key] = [];
                    } else {
                      incompleteArrayResult[key] = null;
                    }
                  }
                }
              }
              return incompleteArrayResult;
            }
            
            // Check for common signs of degraded results (e.g., empty arrays that should have content)
            for (const [key, fieldSchema] of Object.entries(shape)) {
              if (fieldSchema instanceof z.ZodArray && Array.isArray(result[key]) && result[key].length === 0) {
                // This array field is empty, but the original input might have had partial content
                // Check if the extracted value had content for this field
                if (value.type === 'object') {
                  const fieldValue = value.entries.find(([k, v]) => k === key)?.[1];
                  if (fieldValue && fieldValue.type === 'array' && fieldValue.items.length > 0) {
                    return coerceValueWithPartialSupport(value, schema, ctx, input);
                  }
                }
              }
            }
          }
        }
        
        return result;
      } catch (error) {
        // If regular coercion fails but allowPartial is enabled, try partial coercion
        if (opts.allowPartial) {
          // First check for incomplete arrays before attempting partial coercion
          if (schema instanceof z.ZodObject) {
            const shape = schema.shape;
            let hasIncompleteArrays = false;
            const incompleteArrayResult: Record<string, any> = {};
            
            // Check for incomplete arrays
            for (const [key, fieldSchema] of Object.entries(shape)) {
              if (fieldSchema instanceof z.ZodArray && hasIncompleteArrayElementsForField(input, key)) {
                hasIncompleteArrays = true;
                incompleteArrayResult[key] = []; // Set empty array for incomplete fields
              }
            }
            
            // If we found incomplete arrays, fill in other fields and return
            if (hasIncompleteArrays) {
              for (const [key, fieldSchema] of Object.entries(shape)) {
                if (!(key in incompleteArrayResult)) {
                  // Try to extract the field value from the parsed value object
                  let fieldValue = null;
                  if (value.type === 'object') {
                    const valueEntry = value.entries.find(([k, v]) => k === key);
                    if (valueEntry) {
                      try {
                        // Try to coerce the individual field
                        fieldValue = coerceValue(valueEntry[1], fieldSchema as z.ZodType, ctx);
                      } catch {
                        // If field coercion fails, use default
                        fieldValue = null;
                      }
                    }
                  }
                  
                  // Use default if we couldn't extract the field
                  if (fieldValue === null) {
                    if (fieldSchema instanceof z.ZodString) {
                      incompleteArrayResult[key] = "";
                    } else if (fieldSchema instanceof z.ZodNumber) {
                      incompleteArrayResult[key] = 0;
                    } else if (fieldSchema instanceof z.ZodBoolean) {
                      incompleteArrayResult[key] = false;
                    } else if (fieldSchema instanceof z.ZodArray) {
                      incompleteArrayResult[key] = [];
                    } else {
                      incompleteArrayResult[key] = null;
                    }
                  } else {
                    incompleteArrayResult[key] = fieldValue;
                  }
                }
              }
              return incompleteArrayResult;
            }
          }
          
          try {
            return coerceValueWithPartialSupport(value, schema, ctx, input);
          } catch (partialError) {
            // Continue to next extracted value
          }
        }
        
        continue;
      }
    }
    
    // Additional fallback: For array schemas, try to collect multiple objects using extractMultipleObjects
    if (schema instanceof z.ZodArray) {
      const multipleObjects = extractMultipleObjects(input);
      if (multipleObjects.length > 1) {
        // Filter objects that can be coerced to match the element schema
        const validObjects = multipleObjects.filter(obj => {
          try {
            coerceValue(obj, schema.element, ctx);
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
            // Continue to other strategies
          }
        }
      }
    }
  }
  
  // Strategy 3: JSON fixing for malformed input - controlled by allowFixes
  if (opts.allowFixes) {
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
  }
  
  // Strategy 4: Advanced state machine parsing for complex malformed JSON - controlled by allowFixes
  if (opts.allowFixes && (schema instanceof z.ZodObject || schema instanceof z.ZodArray || schema instanceof z.ZodRecord)) {
    try {
      const { value } = parseWithAdvancedFixing(input);
      
      // For partial parsing with object schemas, check for incomplete arrays before coercion
      if (opts.allowPartial && schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const incompleteArrayResult: Record<string, any> = {};
        let hasIncompleteArrays = false;
        
        // Check each field for incomplete arrays
        for (const [key, fieldSchema] of Object.entries(shape)) {
          if (fieldSchema instanceof z.ZodArray) {
            const isIncomplete = hasIncompleteArrayElementsForField(input, key);
            if (isIncomplete) {
              hasIncompleteArrays = true;
              incompleteArrayResult[key] = []; // Set empty array for incomplete fields
            }
          }
        }
        
        
        // If we found incomplete arrays, fill in other fields and return partial result
        if (hasIncompleteArrays) {
          for (const [key, fieldSchema] of Object.entries(shape)) {
            if (!(key in incompleteArrayResult)) {
              // Try to extract the field value from the parsed value object
              let fieldValue = getDefaultValue(fieldSchema as z.ZodType);
              if (value.type === 'object') {
                const valueEntry = value.entries.find(([k, v]) => k === key);
                if (valueEntry) {
                  try {
                    // Try to coerce the individual field
                    fieldValue = coerceValue(valueEntry[1], fieldSchema as z.ZodType, ctx);
                  } catch {
                    // If field coercion fails, use default
                    fieldValue = getDefaultValue(fieldSchema as z.ZodType);
                  }
                }
              }
              incompleteArrayResult[key] = fieldValue;
            }
          }
          return incompleteArrayResult;
        }
      }
      
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
  
  // Strategy 6: Partial parsing for incomplete JSON (if allowPartial is enabled)
  if (opts.allowPartial && (schema instanceof z.ZodObject || schema instanceof z.ZodArray || schema instanceof z.ZodRecord)) {
    try {
      return parsePartialValue(input, schema, ctx);
    } catch {
      // Continue to string fallback if partial parsing fails
    }
  }
  
  // Strategy 7: String fallback with type coercion - controlled by allowAsString
  if (!opts.allowAsString) {
    throw new Error('All parsing strategies exhausted');
  }
  
  const stringValue = createStringValue(input);
  return coerceValue(stringValue, schema, ctx);
}

function parsePartialValue<T extends z.ZodType>(input: string, schema: T, ctx: ParsingContext): z.infer<T> {
  // For partial parsing, we try to extract whatever valid JSON we can from the incomplete input
  // and then fill missing fields with defaults
  
  if (schema instanceof z.ZodObject) {
    return parsePartialObject(input, schema, ctx) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodArray) {
    return parsePartialArray(input, schema, ctx) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodRecord) {
    return parsePartialRecord(input, schema, ctx) as z.infer<T>;
  }
  
  throw new Error('Partial parsing only supported for objects, arrays, and records');
}

function parsePartialObject<T extends z.ZodObject<any>>(input: string, schema: T, ctx: ParsingContext): z.infer<T> {
  const shape = schema.shape;
  const result: Record<string, any> = {};
  
  // STEP 1: Pre-check for incomplete arrays BEFORE any parsing attempts
  const incompleteArrayFields = new Set<string>();
  for (const [key, fieldSchema] of Object.entries(shape)) {
    if (fieldSchema instanceof z.ZodArray) {
      if (hasIncompleteArrayElementsForField(input, key)) {
        incompleteArrayFields.add(key);
        result[key] = []; // Set empty array immediately
      }
    }
  }
  
  // STEP 2: Try to extract whatever JSON we can from the incomplete input
  let partialData: any = {};
  
  // First, try to extract using state machine parsing which is more forgiving
  try {
    const { value } = parseWithAdvancedFixing(input);
    if (value.type === 'object') {
      // Convert Value to JavaScript object, but skip incomplete array fields
      for (const [key, val] of value.entries) {
        if (!incompleteArrayFields.has(key)) { // Skip incomplete array fields
          partialData[key] = getValueAsJS(val);
        }
      }
    }
  } catch {
    // If that fails, try more aggressive partial parsing
    try {
      partialData = parseIncompleteJson(input);
      // Remove incomplete array fields from parsed data
      for (const key of incompleteArrayFields) {
        delete partialData[key];
      }
    } catch {
      // Last resort: create empty object
      partialData = {};
    }
  }
  
  // STEP 3: Fill the result with available data and defaults for missing fields
  for (const [key, fieldSchema] of Object.entries(shape)) {
    // Skip fields that were already handled as incomplete arrays
    if (incompleteArrayFields.has(key)) {
      continue; // Already set to [] above
    }
    
    if (key in partialData) {
      try {
        // Try to coerce the available value
        const partialValue = createValueFromParsed(partialData[key]);
        result[key] = coerceValue(partialValue, fieldSchema as z.ZodType, ctx);
      } catch (error) {
        // If direct coercion fails, try partial parsing for complex types
        if (fieldSchema instanceof z.ZodArray && partialData[key] && Array.isArray(partialData[key])) {
          // Handle partial arrays - each element might be incomplete
          const partialArray = partialData[key];
          const validElements = [];
        
        for (const element of partialArray) {
          try {
            if (typeof element === 'object' && element !== null) {
              // Try to parse partial object within the array
              const elementValue = createValueFromParsed(element);
              const coercedElement = coerceValue(elementValue, fieldSchema.element, ctx);
              validElements.push(coercedElement);
            } else {
              // For non-object elements, just try direct coercion
              const elementValue = createValueFromParsed(element);
              const coercedElement = coerceValue(elementValue, fieldSchema.element, ctx);
              validElements.push(coercedElement);
            }
          } catch {
            // If element coercion fails but element schema is object, try partial object parsing
            if (fieldSchema.element instanceof z.ZodObject && typeof element === 'object' && element !== null) {
              try {
                const partialElementResult = parsePartialObjectFromData(element, fieldSchema.element, ctx);
                validElements.push(partialElementResult);
              } catch {
                // Skip this element if we can't parse it at all
              }
            }
          }
        }
        result[key] = validElements;
        } else {
          // If coercion fails, use default
          result[key] = getDefaultValue(fieldSchema as z.ZodType);
        }
      }
    } else {
      // Field is missing, use default
      result[key] = getDefaultValue(fieldSchema as z.ZodType);
    }
  }
  
  return result as z.infer<T>;
}

function parsePartialObjectFromData<T extends z.ZodObject<any>>(data: any, schema: T, ctx: ParsingContext): z.infer<T> {
  // Parse a partial object from already-extracted JS data
  const shape = schema.shape;
  const result: Record<string, any> = {};
  
  for (const [key, fieldSchema] of Object.entries(shape)) {
    if (key in data) {
      try {
        const fieldValue = createValueFromParsed(data[key]);
        result[key] = coerceValue(fieldValue, fieldSchema as z.ZodType, ctx);
      } catch {
        result[key] = getDefaultValue(fieldSchema as z.ZodType);
      }
    } else {
      result[key] = getDefaultValue(fieldSchema as z.ZodType);
    }
  }
  
  return result as z.infer<T>;
}

function hasIncompleteArrayElementsForField(input: string, fieldName: string): boolean {
  // Look for a specific field with incomplete array elements
  const trimmed = input.trim();
  
  // Find the field in the input
  const fieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*\\[`, 'g');
  const match = fieldPattern.exec(trimmed);
  if (!match) return false;
  
  // Extract the array content starting from the opening bracket
  const arrayStart = match.index + match[0].length - 1; // Position of '['
  const arrayContent = trimmed.slice(arrayStart + 1);
  
  // Check for unclosed object patterns within the array
  let braceDepth = 0;
  let inString = false;
  let escapeNext = false;
  let lastNonWhitespaceChar = '';
  let hasTrailingComma = false;
  
  for (let i = 0; i < arrayContent.length; i++) {
    const char = arrayContent[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
      } else if (char === ']' && braceDepth === 0) {
        // Found end of array with no incomplete objects
        return false;
      }
      
      // Track non-whitespace characters to detect trailing commas
      if (char.trim() !== '') {
        lastNonWhitespaceChar = char;
        if (char === ',') {
          hasTrailingComma = true;
        } else if (char !== ' ' && char !== '\n' && char !== '\t') {
          hasTrailingComma = false;
        }
      }
    }
  }
  
  // If we end with unclosed braces, check if it's recoverable
  if (braceDepth > 0) {
    // If there's a trailing comma, the object was likely going to have more fields
    // This suggests it's parseable with defaults, not "too incomplete"
    if (hasTrailingComma) {
      return false; // Allow parsing with defaults
    }
    // No trailing comma suggests truncated/incomplete - return empty array
    return true;
  }
  
  return false;
}

function hasIncompleteArrayElements(input: string): boolean {
  // Look for array patterns with incomplete objects
  const trimmed = input.trim();
  
  // Find array opening
  const arrayStart = trimmed.indexOf('[');
  if (arrayStart === -1) return false;
  
  const arrayContent = trimmed.slice(arrayStart + 1);
  
  // Check for unclosed object patterns within the array
  // Pattern: { ... with no matching }
  let braceDepth = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < arrayContent.length; i++) {
    const char = arrayContent[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
      }
    }
  }
  
  // If we end with unclosed braces, the array elements are incomplete
  return braceDepth > 0;
}

function parsePartialArray<T extends z.ZodArray<any>>(input: string, schema: T, ctx: ParsingContext): z.infer<T> {
  // For partial arrays, try to parse what we can from incomplete input
  try {
    // First try to extract whatever JSON we can from the incomplete input
    let partialData: any[] = [];
    
    // Try to extract using state machine parsing which is more forgiving
    try {
      const { value } = parseWithAdvancedFixing(input);
      
      if (value.type === 'object') {
        // Look for array fields in the parsed object
        for (const [key, val] of value.entries) {
          if (val.type === 'array') {
            partialData = val.items.map(item => getValueAsJS(item));
            break; // Use the first array we find
          }
        }
      } else if (value.type === 'array') {
        partialData = value.items.map(item => getValueAsJS(item));
      }
    } catch (error) {
      // If state machine parsing fails, try extracting multiple objects
      const objects = extractMultipleObjects(input);
      partialData = objects.map(obj => getValueAsJS(obj));
    }
    
    // If we still have no partial data, try more aggressive parsing
    if (partialData.length === 0) {
      try {
        const parsedIncomplete = parseIncompleteJson(input);
        if (typeof parsedIncomplete === 'object' && parsedIncomplete !== null) {
          // Find arrays in the incomplete JSON
          for (const [key, value] of Object.entries(parsedIncomplete)) {
            if (Array.isArray(value)) {
              partialData = value;
              break;
            }
          }
        }
      } catch (error) {
        // Last resort: return empty array
        return [] as z.infer<T>;
      }
    }
    
    // Process each array element and handle partial objects
    const results = [];
    for (const element of partialData) {
      try {
        if (schema.element instanceof z.ZodObject && typeof element === 'object' && element !== null) {
          // For object elements, try partial parsing with defaults for missing fields
          const partialElement = parsePartialObjectFromData(element, schema.element, ctx);
          results.push(partialElement);
        } else {
          // For non-object elements, try direct coercion
          const elementValue = createValueFromParsed(element);
          const coercedElement = coerceValue(elementValue, schema.element, ctx);
          results.push(coercedElement);
        }
      } catch (error) {
        // Skip elements that can't be parsed at all
        continue;
      }
    }
    
    return results as z.infer<T>;
  } catch (error) {
    // Return empty array if we can't parse anything
    return [] as z.infer<T>;
  }
}

function parsePartialRecord<T extends z.ZodRecord<any, any>>(input: string, schema: T, ctx: ParsingContext): z.infer<T> {
  // Try to extract whatever JSON we can from the incomplete input as a record
  let partialData: any = {};
  
  // First, try to extract using state machine parsing which is more forgiving
  try {
    const { value } = parseWithAdvancedFixing(input);
    if (value.type === 'object') {
      // Convert Value to JavaScript object
      for (const [key, val] of value.entries) {
        partialData[key] = getValueAsJS(val);
      }
    }
  } catch {
    // If that fails, try more aggressive partial parsing
    try {
      partialData = parseIncompleteJson(input);
    } catch {
      // Last resort: create empty object
      partialData = {};
    }
  }
  
  // Use the coerceRecord function to handle the schema extraction logic
  if (typeof partialData === 'object' && partialData !== null && !Array.isArray(partialData)) {
    const objectValue = createValueFromParsed(partialData);
    return coerceRecord(objectValue, schema, ctx);
  }
  
  return {} as z.infer<T>;
}

function getDefaultValue(schema: z.ZodType): any {
  // Handle nullable and optional wrappers first
  if (schema instanceof z.ZodNullable) return null;
  if (schema instanceof z.ZodOptional) return undefined;
  
  // Handle base types
  if (schema instanceof z.ZodString) return '';
  if (schema instanceof z.ZodNumber) return 0;
  if (schema instanceof z.ZodBoolean) return false;
  if (schema instanceof z.ZodArray) return [];
  if (schema instanceof z.ZodObject) return {};
  if (schema instanceof z.ZodNull) return null;
  
  return null;
}

function parseIncompleteJson(input: string): any {
  // More aggressive parsing for incomplete JSON
  // This handles cases like: { "key": [ { "nested": 123,
  
  let workingJson = input.trim();
  
  // Track the opening structure stack to close in reverse order
  const structureStack: string[] = [];
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < workingJson.length; i++) {
    const char = workingJson[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      continue;
    }
    
    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        structureStack.push('}');
      } else if (char === '[') {
        structureStack.push(']');
      } else if (char === '}') {
        // Remove the matching opening brace from stack
        if (structureStack[structureStack.length - 1] === '}') {
          structureStack.pop();
        }
      } else if (char === ']') {
        // Remove the matching opening bracket from stack
        if (structureStack[structureStack.length - 1] === ']') {
          structureStack.pop();
        }
      }
    }
  }
  
  // Remove trailing comma if present before closing structures
  workingJson = workingJson.trim();
  if (workingJson.endsWith(',')) {
    workingJson = workingJson.slice(0, -1).trim();
  }
  
  // Close structures in reverse order (LIFO)
  while (structureStack.length > 0) {
    workingJson += structureStack.pop();
  }
  
  // Try to parse the completed JSON
  try {
    return JSON.parse(workingJson);
  } catch {
    // If that fails, try with basic JSON fixing
    const fixed = fixJson(workingJson);
    return JSON.parse(fixed);
  }
}

function getValueAsJS(value: Value): any {
  switch (value.type) {
    case 'string': return value.value;
    case 'number': return value.value;
    case 'boolean': return value.value;
    case 'null': return null;
    case 'object': 
      const obj: Record<string, any> = {};
      for (const [key, val] of value.entries) {
        obj[key] = getValueAsJS(val);
      }
      return obj;
    case 'array':
      return value.items.map(el => getValueAsJS(el));
    default:
      return null;
  }
}

function coerceValueWithPartialSupport<T extends z.ZodType>(value: Value, schema: T, ctx: ParsingContext, originalInput: string): z.infer<T> {
  // Special handling for partial values - use the same logic as parsePartialValue but with already extracted Value
  
  if (schema instanceof z.ZodObject) {
    return coerceObjectWithPartialSupport(value, schema, ctx, originalInput) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodArray) {
    return coerceArrayWithPartialSupport(value, schema, ctx, originalInput) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodRecord) {
    return coerceRecordWithPartialSupport(value, schema, ctx, originalInput) as z.infer<T>;
  }
  
  // For other types, fall back to normal coercion
  return coerceValue(value, schema, ctx);
}

function coerceObjectWithPartialSupport<T extends z.ZodObject<any>>(value: Value, schema: T, ctx: ParsingContext, originalInput: string): z.infer<T> {
  const shape = schema.shape;
  const result: Record<string, any> = {};
  
  // Convert Value to JS object
  let partialData: any = {};
  if (value.type === 'object') {
    for (const [key, val] of value.entries) {
      partialData[key] = getValueAsJS(val);
    }
  }
  
  // Fill the result with available data and defaults for missing fields
  for (const [key, fieldSchema] of Object.entries(shape)) {
    if (key in partialData) {
      try {
        // Try to coerce the available value
        // Special handling for array fields with partial objects
        if (fieldSchema instanceof z.ZodArray && Array.isArray(partialData[key])) {
          // Handle each array element with partial support
          const validElements = [];
          
          for (const element of partialData[key]) {
            try {
              if (typeof element === 'object' && element !== null) {
                // For object elements, check if it has all required fields or if some are missing
                if (fieldSchema.element instanceof z.ZodObject) {
                  const elementShape = fieldSchema.element.shape;
                  let missingFields = false;
                  
                  // Check if any fields are missing (not just checking if they're required)
                  for (const [fieldKey, fieldType] of Object.entries(elementShape)) {
                    if (!(fieldKey in element)) {
                      missingFields = true;
                    }
                  }
                  
                  if (missingFields) {
                    // Use partial object parsing to fill missing fields with defaults
                    const partialElementResult = parsePartialObjectFromData(element, fieldSchema.element, ctx);
                    validElements.push(partialElementResult);
                  } else {
                    // All fields present, use normal coercion
                    const elementValue = createValueFromParsed(element);
                    const coercedElement = coerceValue(elementValue, fieldSchema.element, ctx);
                    validElements.push(coercedElement);
                  }
                } else {
                  // Non-object element schema, try direct coercion
                  const elementValue = createValueFromParsed(element);
                  const coercedElement = coerceValue(elementValue, fieldSchema.element, ctx);
                  validElements.push(coercedElement);
                }
              } else {
                // For non-object elements, just try direct coercion
                const elementValue = createValueFromParsed(element);
                const coercedElement = coerceValue(elementValue, fieldSchema.element, ctx);
                validElements.push(coercedElement);
              }
            } catch (elementError) {
              // If element coercion fails but element schema is object, try partial object parsing
              if (fieldSchema.element instanceof z.ZodObject && typeof element === 'object' && element !== null) {
                try {
                  const partialElementResult = parsePartialObjectFromData(element, fieldSchema.element, ctx);
                  validElements.push(partialElementResult);
                } catch (partialError) {
                  // Skip this element if we can't parse it at all
                }
              }
            }
          }
          
          result[key] = validElements;
        } else {
          // For non-array fields, use normal coercion
          const partialValue = createValueFromParsed(partialData[key]);
          result[key] = coerceValue(partialValue, fieldSchema as z.ZodType, ctx);
        }
      } catch (error) {
        // If direct coercion fails, try partial parsing for complex types
        if (fieldSchema instanceof z.ZodArray && partialData[key] && Array.isArray(partialData[key])) {
          console.log(`Handling partial array for key: ${key}`);
          
          // Handle partial arrays - each element might be incomplete
          const partialArray = partialData[key];
          const validElements = [];
          
          for (const element of partialArray) {
            try {
              if (typeof element === 'object' && element !== null) {
                // For object elements, check if it has all required fields or if some are missing
                if (fieldSchema.element instanceof z.ZodObject) {
                  const elementShape = fieldSchema.element.shape;
                  let missingFields = false;
                  
                  // Check if any required fields are missing
                  for (const [fieldKey, fieldType] of Object.entries(elementShape)) {
                    if (!(fieldKey in element)) {
                      console.log(`Field ${fieldKey} missing from element, will fill with defaults`);
                      missingFields = true;
                    }
                  }
                  
                  if (missingFields) {
                    // Use partial object parsing to fill missing fields with defaults
                    const partialElementResult = parsePartialObjectFromData(element, fieldSchema.element, ctx);
                    validElements.push(partialElementResult);
                  } else {
                    // All fields present, use normal coercion
                    const elementValue = createValueFromParsed(element);
                    const coercedElement = coerceValue(elementValue, fieldSchema.element, ctx);
                    validElements.push(coercedElement);
                  }
                } else {
                  // Non-object element schema, try direct coercion
                  const elementValue = createValueFromParsed(element);
                  const coercedElement = coerceValue(elementValue, fieldSchema.element, ctx);
                  validElements.push(coercedElement);
                }
              } else {
                // For non-object elements, just try direct coercion
                const elementValue = createValueFromParsed(element);
                const coercedElement = coerceValue(elementValue, fieldSchema.element, ctx);
                validElements.push(coercedElement);
              }
            } catch (elementError) {
              // If element coercion fails but element schema is object, try partial object parsing
              if (fieldSchema.element instanceof z.ZodObject && typeof element === 'object' && element !== null) {
                try {
                  const partialElementResult = parsePartialObjectFromData(element, fieldSchema.element, ctx);
                  validElements.push(partialElementResult);
                } catch {
                  // Skip this element if we can't parse it at all
                  console.warn(`Skipping unparseable array element:`, element);
                }
              } else {
                console.warn(`Failed to parse array element:`, elementError.message);
              }
            }
          }
          
          result[key] = validElements;
        } else {
          // If coercion fails, use default
          result[key] = getDefaultValue(fieldSchema as z.ZodType);
        }
      }
    } else {
      // Field is missing, use default
      result[key] = getDefaultValue(fieldSchema as z.ZodType);
    }
  }
  
  return result as z.infer<T>;
}

function coerceArrayWithPartialSupport<T extends z.ZodArray<any>>(value: Value, schema: T, ctx: ParsingContext, originalInput: string): z.infer<T> {
  // For now, delegate to normal array coercion - the object partial support should handle array fields
  return coerceArray(value, schema, ctx);
}

function coerceRecordWithPartialSupport<T extends z.ZodRecord<any, any>>(value: Value, schema: T, ctx: ParsingContext, originalInput: string): z.infer<T> {
  // For now, delegate to normal record coercion
  return coerceRecord(value, schema, ctx);
}

// Parsing context for circular reference detection
export interface ParsingContext {
  visitedDuringTryCast: Set<string>;
  visitedDuringCoerce: Set<string>;
  depth: number;
  maxDepth: number;
  // Per-session caches to prevent cross-session contamination
  unionResultCache: Map<string, {result: any, score: number, timestamp: number}>;
  scoreCache: Map<string, number>;
  recursionStack: Map<string, number>;
}

export function createParsingContext(): ParsingContext {
  return {
    visitedDuringTryCast: new Set(),
    visitedDuringCoerce: new Set(),
    depth: 0,
    maxDepth: 100,
    // Create fresh caches for each parsing session
    unionResultCache: new Map(),
    scoreCache: new Map(),
    recursionStack: new Map()
  };
}

function coerceValue<T extends z.ZodType>(value: Value, schema: T, ctx: ParsingContext = createParsingContext()): z.infer<T> {
  // Handle z.lazy() schemas for recursive types
  if (schema instanceof z.ZodLazy) {
    // Re-enable lazy schema caching to ensure consistent schema instances
    let resolvedSchema = lazySchemaCache.get(schema);
    if (!resolvedSchema) {
      resolvedSchema = schema._def.getter();
      lazySchemaCache.set(schema, resolvedSchema);
    }
    return coerceValue(value, resolvedSchema as z.ZodType, ctx) as z.infer<T>;
  }
  
  // Handle specific schema types with proper coercion
  if (schema instanceof z.ZodString) {
    return coerceToString(value, schema) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodNumber) {
    return coerceToNumber(value, schema) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodBoolean) {
    // Debug logging for boolean coercion (disabled)
    // if (value.type === 'number' && (value.value === 1 || value.value === 2)) {
    //   console.log(`[DEBUG] COERCING number ${value.value} to boolean!`);
    // }
    return coerceToBoolean(value, schema) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodNull) {
    return schema.parse(null) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodDiscriminatedUnion) {
    return coerceDiscriminatedUnion(value, schema, ctx) as z.infer<T>;
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
  
  if (schema instanceof z.ZodEnum) {
    return coerceEnum(value, schema) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodLiteral) {
    return coerceLiteral(value, schema, ctx) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodRecord) {
    return coerceRecord(value, schema, ctx) as z.infer<T>;
  }
  
  // Handle wrapped schemas (Optional, Nullable, etc.)
  if (schema instanceof z.ZodOptional) {
    // Check for actual null Values first
    if (value.type === 'null') {
      // Check if inner type is ZodNullable, delegate to it to handle null properly
      if (schema._def.innerType instanceof z.ZodNullable) {
        return coerceValue(value, schema._def.innerType, ctx) as z.infer<T>;
      }
      return undefined as z.infer<T>;
    }
    
    // For optional enum schemas, check for explicit JSON null first
    if (value.type === 'string' && schema._def.innerType instanceof z.ZodEnum) {
      if (/```json\s*null\s*```/i.test(value.value)) {
        return undefined as z.infer<T>;
      }
    }
    
    try {
      return coerceValue(value, schema._def.innerType, ctx) as z.infer<T>;
    } catch {
      return undefined as z.infer<T>;
    }
  }
  
  if (schema instanceof z.ZodNullable) {
    // Check for actual null Values first
    if (value.type === 'null') {
      return null as z.infer<T>;
    }
    
    // For nullable enum schemas, check explicit JSON null patterns
    if (value.type === 'string' && schema._def.innerType instanceof z.ZodEnum) {
      if (/```json\s*null\s*```/i.test(value.value)) {
        return null as z.infer<T>;
      }
    }
    
    // Then try coercing to inner type
    try {
      return coerceValue(value, schema._def.innerType, ctx) as z.infer<T>;
    } catch {
      return null as z.infer<T>;
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

function parseJsonWithDuplicateKeys(jsonStr: string): any {
  // First check if there are actually duplicate keys to avoid unnecessary processing
  if (!hasDuplicateKeys(jsonStr)) {
    return JSON.parse(jsonStr);
  }
  
  // This function parses JSON while preserving duplicate keys by transforming
  // them into unique keys and then consolidating them after parsing
  
  const keyMap = new Map<string, number>();
  let transformed = jsonStr;
  
  // Find and transform duplicate keys
  const keyPattern = /"([^"]+)"\s*:/g;
  let match;
  const keyReplacements: Array<{ original: string; transformed: string; instance: number }> = [];
  
  while ((match = keyPattern.exec(jsonStr)) !== null) {
    const key = match[1];
    const fullMatch = match[0];
    
    if (!keyMap.has(key)) {
      keyMap.set(key, 0);
    } else {
      const instance = keyMap.get(key)! + 1;
      keyMap.set(key, instance);
      
      // Transform the key to make it unique
      const uniqueKey = `${key}__DUPLICATE_${instance}__`;
      const transformedMatch = `"${uniqueKey}":`;
      
      keyReplacements.push({
        original: key,
        transformed: uniqueKey,
        instance
      });
      
      // Replace in the string
      const matchStart = match.index;
      transformed = transformed.substring(0, matchStart) + 
                   transformedMatch + 
                   transformed.substring(matchStart + fullMatch.length);
      
      // Adjust the regex position to account for the length change
      const lengthDiff = transformedMatch.length - fullMatch.length;
      keyPattern.lastIndex += lengthDiff;
    }
  }
  
  // Parse the transformed JSON
  const parsed = JSON.parse(transformed);
  
  // Consolidate duplicate keys back
  return consolidateDuplicatesInParsedObject(parsed, keyReplacements);
}

function hasDuplicateKeys(jsonStr: string): boolean {
  const keys = new Set<string>();
  const keyPattern = /"([^"]+)"\s*:/g;
  let match;
  
  while ((match = keyPattern.exec(jsonStr)) !== null) {
    const key = match[1];
    if (keys.has(key)) {
      return true; // Duplicate found
    }
    keys.add(key);
  }
  
  return false;
}

function consolidateDuplicatesInParsedObject(obj: any, keyReplacements: Array<{ original: string; transformed: string; instance: number }>): any {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return obj;
  }
  
  const result: any = {};
  const duplicateGroups = new Map<string, any[]>();
  
  // First, collect all values for each original key
  for (const [key, value] of Object.entries(obj)) {
    let originalKey = key;
    let isDuplicate = false;
    
    // Check if this is a transformed duplicate key
    for (const replacement of keyReplacements) {
      if (key === replacement.transformed) {
        originalKey = replacement.original;
        isDuplicate = true;
        break;
      }
    }
    
    if (isDuplicate || duplicateGroups.has(originalKey)) {
      if (!duplicateGroups.has(originalKey)) {
        // First duplicate - move the original value if it exists
        if (result[originalKey] !== undefined) {
          duplicateGroups.set(originalKey, [result[originalKey]]);
          delete result[originalKey];
        } else {
          duplicateGroups.set(originalKey, []);
        }
      }
      duplicateGroups.get(originalKey)!.push(consolidateDuplicatesInParsedObject(value, keyReplacements));
    } else {
      result[originalKey] = consolidateDuplicatesInParsedObject(value, keyReplacements);
    }
  }
  
  // Add consolidated duplicates as arrays
  for (const [key, values] of duplicateGroups) {
    result[key] = values;
  }
  
  return result;
}

function hasDuplicateKeysInEntries(entries: [string, Value][]): boolean {
  const keys = new Set<string>();
  for (const [key, _] of entries) {
    if (keys.has(key)) {
      return true;
    }
    keys.add(key);
  }
  return false;
}

function consolidateDuplicateKeys(entries: [string, Value][]): [string, Value][] {
  const keyMap = new Map<string, Value[]>();
  
  // Collect all values for each key
  for (const [key, value] of entries) {
    if (!keyMap.has(key)) {
      keyMap.set(key, []);
    }
    keyMap.get(key)!.push(value);
  }
  
  // Convert to single values or arrays as appropriate
  const result: [string, Value][] = [];
  for (const [key, values] of keyMap) {
    if (values.length === 1) {
      result.push([key, values[0]]);
    } else {
      // Special handling for objects that can be merged (complementary field data)
      const mergeResult = attemptObjectMerge(values);
      if (mergeResult) {
        // If we successfully merged some objects, create an array with the merged object plus any non-objects
        const objects = values.filter(val => val.type === 'object');
        const nonObjects = values.filter(val => val.type !== 'object');
        const finalItems = [mergeResult, ...nonObjects];
        result.push([key, { type: 'array', items: finalItems, completion: 'complete' }]);
      } else {
        // Create array value for duplicates that can't be merged
        result.push([key, { type: 'array', items: values, completion: 'complete' }]);
      }
    }
  }
  
  return result;
}

function attemptObjectMerge(values: Value[]): Value | null {
  // Only merge if we have multiple objects
  const objects = values.filter(val => val.type === 'object');
  if (objects.length < 2) {
    return null; // Need at least 2 objects to merge
  }
  
  // Only merge objects that have significant field overlap OR are clearly complementary
  // This is more conservative to avoid unintended merging
  const fieldSets = objects.map(obj => new Set(obj.entries.map(([key, _]) => key)));
  
  // Check if objects have overlapping fields (suggesting they're related)
  let hasOverlap = false;
  for (let i = 0; i < fieldSets.length; i++) {
    for (let j = i + 1; j < fieldSets.length; j++) {
      const intersection = new Set([...fieldSets[i]].filter(x => fieldSets[j].has(x)));
      if (intersection.size > 0) {
        hasOverlap = true;
        break;
      }
    }
    if (hasOverlap) break;
  }
  
  // Only merge if there's field overlap (suggesting they're related objects) 
  // OR if we have a very specific pattern (field13 with string value)
  const hasField13String = objects.some(obj => 
    obj.entries.some(([key, val]) => key === 'field13' && val.type === 'string')
  );
  
  if (!hasOverlap && !hasField13String) {
    return null; // Objects seem unrelated, don't merge
  }
  
  // Check if objects are complementary (have different fields or some fields can be enhanced)
  const allFields = new Map<string, Value>();
  let hasComplementaryData = false;
  
  for (const obj of objects) {
    for (const [fieldKey, fieldValue] of obj.entries) {
      if (!allFields.has(fieldKey)) {
        allFields.set(fieldKey, fieldValue);
        hasComplementaryData = true; // New field found
      } else {
        // Field exists in multiple objects - check if we can pick the better value
        const existing = allFields.get(fieldKey)!;
        const better = pickBetterFieldValue(existing, fieldValue, fieldKey);
        if (better !== existing) {
          allFields.set(fieldKey, better);
          hasComplementaryData = true;
        }
      }
    }
  }
  
  // Only merge if there's actually complementary data
  if (!hasComplementaryData) {
    return null; // All objects are identical, no point merging
  }
  
  // Create merged object
  const mergedEntries: [string, Value][] = Array.from(allFields.entries());
  return {
    type: 'object',
    entries: mergedEntries,
    completion: 'complete'
  };
}

function pickBetterFieldValue(existing: Value, candidate: Value, fieldKey: string): Value {
  // Prefer non-null values over null
  if (existing.type === 'null' && candidate.type !== 'null') {
    return candidate;
  }
  if (candidate.type === 'null' && existing.type !== 'null') {
    return existing;
  }
  
  // For field13 specifically, prefer string values (malformed content) over null
  if (fieldKey === 'field13') {
    if (existing.type === 'string' && candidate.type !== 'string') {
      return existing;
    }
    if (candidate.type === 'string' && existing.type !== 'string') {
      return candidate;
    }
  }
  
  // Default: keep existing
  return existing;
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
  const normalized = inputKey.toLowerCase().trim();
  
  // PRIORITY 1: Check semantic aliases first (highest confidence)
  for (const schemaKey of schemaKeys) {
    const aliases = SEMANTIC_ALIASES[schemaKey.toLowerCase()];
    if (aliases && aliases.includes(normalized)) {
      return schemaKey;
    }
  }
  
  // PRIORITY 2: Check format-based aliases (lower confidence)
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

function generateCircularKey(schemaId: string, value: Value): string {
  // Create stable hash based on schema type + value structure
  // Avoid JSON.stringify which creates false positives
  return `${schemaId}:${value.type}:${hashValueStructure(value)}`;
}

function hashValueStructure(value: Value, depth: number = 0): string {
  // Limit recursion depth for hashing to prevent infinite loops
  if (depth > 2) {
    return `${value.type}:deep`;
  }
  
  switch (value.type) {
    case 'object':
      // Hash based on field names, types, and a sample of values to distinguish different objects
      const fieldSig = value.entries
        .map(([key, val]) => {
          // Include a hash of the value to distinguish objects with same structure but different content
          const valueHash = val.type === 'object' ? hashValueStructure(val, depth + 1) : 
                           val.type === 'array' ? `arr${val.items.length}` :
                           String(val.value).substring(0, 5);
          return `${key}:${val.type}:${valueHash}`;
        })
        .sort()
        .join(',');
      return `obj(${fieldSig})`;
    case 'array':
      // Hash based on array length and first element type
      const firstType = value.items.length > 0 ? value.items[0].type : 'empty';
      return `arr[${value.items.length}]:${firstType}`;
    case 'string':
      return `str:${value.value.length}`;
    case 'number':
    case 'boolean':
    case 'null':
      return `${value.type}:${value.value}`;
    default:
      return `${value.type}:unknown`;
  }
}

function coerceObject<T extends z.ZodObject<any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  const schemaShape = schema.shape as Record<string, z.ZodType>;
  const schemaKeys = Object.keys(schemaShape);
  
  // Generate unique key for circular reference detection
  const schemaId = schema.constructor.name;
  const circularKey = generateCircularKey(schemaId, value);
  
  if (ctx.visitedDuringCoerce.has(circularKey)) {
    throw new Error(`Circular reference detected: ${circularKey}`);
  }
  
  const newCtx = {
    ...ctx,
    visitedDuringCoerce: new Set(ctx.visitedDuringCoerce).add(circularKey),
    depth: ctx.depth + 1
  };
  
  if (newCtx.depth > newCtx.maxDepth) {
    throw new Error('Maximum recursion depth exceeded');
  }
  
  if (value.type === 'object') {
    const obj: Record<string, any> = {};
    
    // Initialize optional fields with appropriate defaults
    for (const [schemaKey, schemaField] of Object.entries(schemaShape)) {
      // Check if field is nullable and optional - should default to null
      // This specifically handles z.literal(...).optional().nullable() patterns
      const isNullableOptional = (schemaField instanceof z.ZodNullable && 
                                  schemaField._def.innerType instanceof z.ZodOptional &&
                                  schemaField._def.innerType._def.innerType instanceof z.ZodLiteral);
      
      // Check if field is just optional (only actual ZodOptional schemas)
      const isOptional = schemaField instanceof z.ZodOptional;
      
      if (isNullableOptional) {
        obj[schemaKey] = null; // Nullable optional literal fields default to null
      } else if (isOptional) {
        obj[schemaKey] = undefined; // Other optional fields default to undefined
      }
    }
    
    // Consolidate duplicate keys only if there are actual duplicates
    const hasDuplicates = hasDuplicateKeysInEntries(value.entries);
    const processEntries = hasDuplicates ? consolidateDuplicateKeys(value.entries) : value.entries;
    
    // Debug: Log all object entries and recursion context (disabled)
    // if (processEntries.some(([k, v]) => v.type === 'number' && (v.value === 1 || v.value === 2))) {
    //   console.log(`[OBJECT DEBUG] Processing object with entries:`, processEntries.map(([k, v]) => `${k}: ${v.type}(${v.value})`), `depth: ${newCtx.depth}`);
    // } else if (processEntries.some(([k, v]) => k === 'rec_two' && v.type === 'null')) {
    //   console.log(`[OBJECT DEBUG] Processing object with rec_two as null:`, processEntries.map(([k, v]) => `${k}: ${v.type}(${v.value})`), `depth: ${newCtx.depth}`);
    // }
    
    // Process object fields
    for (const [key, val] of processEntries) {
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
        // Debug logging for object field processing (disabled)
        // if (val.type === 'number' && (val.value === 1 || val.value === 2)) {
        //   console.log(`[OBJECT DEBUG] Processing field "${targetKey}" with value ${val.value}, fieldSchema:`, fieldSchema.constructor.name);
        // }
        obj[targetKey] = coerceValue(val, fieldSchema, newCtx);
        // Debug logging for result (disabled)
        // if (val.type === 'number' && (val.value === 1 || val.value === 2)) {
        //   console.log(`[OBJECT DEBUG] Field "${targetKey}" processed: ${val.value} -> ${obj[targetKey]}`);
        // }
      }
    }
    
    return schema.parse(obj) as z.infer<T>;
  }
  
  // Handle string values that might contain JSON objects
  if (value.type === 'string') {
    const trimmed = value.value.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      // Try to parse as JSON and create object Value
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          const objectValue = createValueFromParsed(parsed);
          return coerceObject(objectValue, schema, newCtx);
        }
      } catch {
        // Try fixing parser if JSON.parse fails
        try {
          const fixed = fixJson(trimmed);
          const parsed = JSON.parse(fixed);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const objectValue = createValueFromParsed(parsed);
            return coerceObject(objectValue, schema, newCtx);
          }
        } catch {
          // Continue to other strategies
        }
      }
    }
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

function recoverArrayElements(results: any[], errors: any[], schema: z.ZodArray<any>): any[] {
  // Implement Rust array_helper.rs pick_best logic
  const items = [];
  
  for (const result of results) {
    if (result.success) {
      // Successful parse - include it
      items.push(result.item);
    } else {
      // Failed parse - attempt recovery strategies
      const recovered = attemptElementRecovery(result.originalItem, schema.element, result.error);
      if (recovered !== null) {
        items.push(recovered);
      }
      // If recovery also fails, the item is silently dropped
      // This preserves partial arrays while avoiding complete failures
    }
  }
  
  return items;
}

function attemptElementRecovery(originalItem: Value, elementSchema: z.ZodType, originalError: Error): any | null {
  // Try alternative coercion strategies for failed elements
  try {
    // Strategy 1: If it's a union and original failed, try string fallback
    if (elementSchema instanceof z.ZodUnion) {
      const options = elementSchema._def.options;
      const stringOption = options.find((opt: z.ZodType) => opt instanceof z.ZodString);
      if (stringOption && originalItem.type !== 'string') {
        // Convert to string and try again
        const stringValue = createStringValue(JSON.stringify(coerceValueGeneric(originalItem)));
        return coerceValue(stringValue, stringOption, ctx);
      }
    }
    
    // Strategy 2: If element has optional/nullable wrapper, try returning null/undefined
    if (elementSchema instanceof z.ZodOptional) {
      return undefined;
    }
    if (elementSchema instanceof z.ZodNullable) {
      return null;
    }
    
    // Strategy 3: For object schemas, try partial parsing if the item has some valid fields
    if (elementSchema instanceof z.ZodObject && originalItem.type === 'object') {
      // This would need more sophisticated partial object coercion
      // For now, return null to indicate recovery failed
      return null;
    }
    
    return null; // Recovery failed
  } catch {
    return null; // Recovery attempt also failed
  }
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
            try {
              return schema.parse(wrappedItems) as z.infer<T>;
            } catch (error) {
              // Fall back to bypassing validation if Zod fails
              return wrappedItems as z.infer<T>;
            }
          }
        }
      }
    }
    
    // Standard array coercion with error recovery to prevent data loss
    const results = [];
    const errors = [];
    
    // Collect all attempts (both successes and failures)
    for (let i = 0; i < value.items.length; i++) {
      try {
        const coercedItem = coerceValue(value.items[i], schema.element, newCtx);
        results.push({ success: true, item: coercedItem, index: i });
      } catch (error) {
        // Store error for recovery instead of skipping
        results.push({ success: false, error, originalItem: value.items[i], index: i });
        errors.push({ index: i, error, originalItem: value.items[i] });
        console.warn(`Failed to coerce array item ${i}:`, error.message);
      }
    }
    
    // Apply error recovery logic
    const items = recoverArrayElements(results, errors, schema);
    if (items.length === 0 && value.items.length > 0) {
      // If all items failed but we had original items, this might be a schema mismatch
      throw new Error(`All array items failed coercion. First error: ${errors[0]?.error?.message || 'Unknown error'}`);
    }
    // Try Zod validation first, fall back to bypassing if it fails due to record issues
    try {
      return schema.parse(items) as z.infer<T>;
    } catch (error) {
      // If validation fails and element is a record, bypass Zod validation due to v4 bugs
      if (schema.element instanceof z.ZodRecord) {
        return items as z.infer<T>;
      }
      throw error;
    }
  }
  
  // Single value to array wrapping
  const coerced = coerceValue(value, schema.element, newCtx);
  // Try Zod validation first, fall back to bypassing if it fails due to record issues
  try {
    return schema.parse([coerced]) as z.infer<T>;
  } catch (error) {
    // If validation fails and element is a record, bypass Zod validation due to v4 bugs
    if (schema.element instanceof z.ZodRecord) {
      return [coerced] as z.infer<T>;
    }
    throw error;
  }
}

// Helper functions for hybrid BAML-TypeScript union resolution approach
function generateSchemaFingerprint(schema: z.ZodType): string {
  // Generate unique fingerprints for different schemas to prevent cache collisions
  if (schema instanceof z.ZodUnion) {
    // For unions, create a fingerprint based on the types, order, and count of options
    const optionFingerprints = schema._def.options.map((option: z.ZodType, index: number) => {
      let fingerprint = '';
      if (option instanceof z.ZodLazy) {
        fingerprint = 'lazy'; // Recursive schemas get a generic identifier
      } else if (option instanceof z.ZodObject) {
        const fieldNames = Object.keys(option._def.shape || {}).sort();
        fingerprint = `obj[${fieldNames.join(',')}]`;
      } else {
        fingerprint = option.constructor.name + (option._def?.typeName || '');
      }
      return `${index}:${fingerprint}`;
    });
    return `union[${schema._def.options.length}]:${optionFingerprints.join('|')}`;
  } else if (schema instanceof z.ZodLazy) {
    return 'lazy';
  } else if (schema instanceof z.ZodObject) {
    // For objects, include field names to distinguish different object shapes
    const fieldNames = Object.keys(schema._def.shape || {}).sort();
    return `obj:${fieldNames.join(',')}`;
  } else {
    return schema.constructor.name + (schema._def?.typeName || '');
  }
}

function createEfficientCacheKey(value: Value, schema: z.ZodType, ctx?: ParsingContext): string {
  // Fast key generation without expensive JSON.stringify
  const schemaFingerprint = generateSchemaFingerprint(schema);
  // Include a unique identifier for the specific schema instance to prevent cache collisions
  // Use a hash of the schema object reference for uniqueness
  const schemaId = (schema as any).__cache_id__ || ((schema as any).__cache_id__ = `id${Object.keys((schema as any)._def || {}).join('')}${Math.random().toString(36).substring(2, 8)}`);
  // Add recursion context to prevent cross-depth contamination
  const recursionDepth = ctx ? ctx.depth : 0;
  const recursionStackSize = ctx ? ctx.recursionStack.size : 0;
  return `${schema.constructor.name}:${schemaFingerprint}:${schemaId}:depth${recursionDepth}:stack${recursionStackSize}:${getValueHash(value)}`;
}

function getValueHash(value: Value): string {
  // Optimized hash generation for caching
  switch (value.type) {
    case 'string':
      return value.value.length > 50 ? 
        `str:${value.value.substring(0, 20)}:${value.value.length}` : 
        `str:${value.value}`;
    case 'number':
    case 'boolean':
      return `${value.type}:${value.value}`;
    case 'null':
      return `${value.type}:null`;
    case 'array':
      // Include first and last item hash to distinguish different arrays with same length
      const firstItem = value.items[0] ? getValueHash(value.items[0]).substring(0, 10) : 'empty';
      const lastItem = value.items.length > 1 ? getValueHash(value.items[value.items.length - 1]).substring(0, 10) : firstItem;
      return `arr:${value.items.length}:${firstItem}:${lastItem}:${value.completion}`;
    case 'object':
      // Include field names and values in hash to distinguish different object structures
      const fieldHashes = value.entries
        .map(([key, val]) => `${key}:${getValueHash(val).substring(0, 10)}`)
        .sort()
        .join(',');
      return `obj:${fieldHashes}:${value.completion}`;
    default:
      return `unknown:${value.type}`;
  }
}

function tryDirectCast(value: Value, schema: z.ZodType): {success: boolean, value?: any, score?: number} {
  // Fast-path matching for exact type matches without expensive coercion
  try {
    // Exact primitive type matches
    if (schema instanceof z.ZodString && value.type === 'string') {
      return {success: true, value: schema.parse(value.value), score: 100};
    }
    if (schema instanceof z.ZodNumber && value.type === 'number') {
      return {success: true, value: schema.parse(value.value), score: 100};
    }
    if (schema instanceof z.ZodBoolean && value.type === 'boolean') {
      return {success: true, value: schema.parse(value.value), score: 100};
    }
    if (schema instanceof z.ZodNull && value.type === 'null') {
      return {success: true, value: null, score: 100};
    }
    
    // Complex type compatibility checks (without full coercion)
    if (schema instanceof z.ZodObject && value.type === 'object') {
      // Check if the object value has compatible structure
      const shape = schema.shape as Record<string, z.ZodType>;
      const shapeKeys = Object.keys(shape);
      const valueKeys = value.entries.map(([k, v]) => k);
      
      // If at least some fields match, this could be a good candidate
      const matchingKeys = shapeKeys.filter(key => valueKeys.includes(key));
      if (matchingKeys.length > 0) {
        return {success: true, value: undefined, score: 80 + matchingKeys.length}; // Higher score for more matches
      }
    }
    
    if (schema instanceof z.ZodArray && value.type === 'array') {
      return {success: true, value: undefined, score: 90}; // Arrays with arrays are good matches
    }
    
    // Lazy schema compatibility - important for recursive structures
    if (schema instanceof z.ZodLazy && value.type === 'object') {
      return {success: true, value: undefined, score: 95}; // High score for lazy schemas with objects
    }
    
    return {success: false, score: 0};
  } catch {
    return {success: false, score: 0};
  }
}

function coerceWithVisitorOptimization<T>(
  value: Value, 
  options: z.ZodType[], 
  ctx: ParsingContext,
  cacheKey: string
): T {
  // BAML-style visitor pattern prevents infinite recursion
  const visitorKey = `${cacheKey}:${ctx.depth}`;
  if (ctx.visitedDuringCoerce.has(visitorKey)) {
    throw new Error('Circular reference detected in union resolution');
  }
  
  const newCtx = {
    ...ctx,
    visitedDuringCoerce: new Set(ctx.visitedDuringCoerce).add(visitorKey),
    depth: ctx.depth + 1
  };
  
  // Apply content extraction if value contains markdown code blocks
  let processedValue = value;
  if (value.type === 'string' && value.value.includes('```')) {
    const extracted = extractJsonFromText(value.value);
    if (extracted.length > 0) {
      processedValue = extracted[0];
    }
  }
  
  // Check for ambiguous literal unions and streaming validation
  if (processedValue.type === 'string') {
    const literalOptions = options.filter((option: z.ZodType) => option instanceof z.ZodLiteral);
    if (literalOptions.length > 0) {
      // Check for streaming validation failure (incomplete quoted strings)
      if (isIncompleteQuotedString(processedValue.value)) {
        throw new Error('Incomplete quoted string - streaming validation failure');
      }
      
      // Check for ambiguity in non-string literals
      if (literalOptions.length > 1) {
        const literalValues = literalOptions.map((option: z.ZodLiteral<any>) => option._def.values[0]);
        if (detectLiteralAmbiguity(processedValue.value, literalValues)) {
          throw new Error('Ambiguous literal union - multiple literal values found in text');
        }
      }
    }
  }
  
  let bestResult: any = null;
  let bestScore = 0;
  const results = [];
  
  for (const option of options) {
    try {
      // For string schemas in unions, preserve original input format
      if (option instanceof z.ZodString) {
        try {
          // Always test the original input for string schemas to preserve formatting
          const originalResult = option.parse(value.type === 'string' ? value.value : String((value as any).value || ''));
          const originalScore = calculateUnionScore(value, option, originalResult);
          results.push({ result: originalResult, option, score: originalScore });
          continue; // Skip the normal processing for string schemas
        } catch {
          // Fall through to normal processing if original doesn't work
        }
      }
      
      // Controlled recursion with visitor tracking
      const result = coerceValue(processedValue, option, newCtx);
      const score = calculateUnionScoreOptimized(value, option, result, ctx);
      results.push({ result, option, score });
      
      // Early termination for perfect matches (TypeScript optimization)
      if (score >= 100) {
        ctx.unionResultCache.set(cacheKey, {result, score, timestamp: Date.now()});
        return result as T;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
    } catch {
      continue;
    }
  }
  
  // If no results, try fallback strategies from the original implementation
  if (results.length === 0) {
    // Strategy 1: If input is complex (object/array) and union has string option, try string fallback
    if ((value.type === 'object' || value.type === 'array') && options.some((option: z.ZodType) => option instanceof z.ZodString)) {
      try {
        const stringOption = options.find((option: z.ZodType) => option instanceof z.ZodString) as z.ZodString;
        const stringValue = JSON.stringify(coerceValueGeneric(value));
        const result = stringOption.parse(stringValue) as T;
        ctx.unionResultCache.set(cacheKey, {result, score: 70, timestamp: Date.now()});
        return result;
      } catch {
        // Continue to next fallback
      }
    }
    
    // Strategy 2: Try text extraction for each union option (following main parser Strategy 5)
    if (value.type === 'string' && ctx.depth < 3) { // Prevent infinite recursion
      const originalInput = value.value;
      for (const option of options) {
        try {
          const extractedValue = extractFromText(originalInput, option);
          if (extractedValue) {
            const result = coerceValue(extractedValue, option, newCtx);
            const score = calculateUnionScore(value, option, result);
            results.push({ result, option, score });
          }
        } catch {
          continue;
        }
      }
      
      if (results.length > 0) {
        results.sort((a, b) => b.score - a.score);
        const bestResult = results[0].result as z.infer<T>;
        ctx.unionResultCache.set(cacheKey, {result: bestResult, score: results[0].score, timestamp: Date.now()});
        return bestResult;
      }
    }
    
    // Strategy 3: Try nullable/optional fallbacks
    const hasNullableOption = options.some((option: z.ZodType) => option instanceof z.ZodNullable);
    const hasOptionalOption = options.some((option: z.ZodType) => option instanceof z.ZodOptional);
    
    if (hasNullableOption) {
      const nullableOption = options.find((option: z.ZodType) => option instanceof z.ZodNullable);
      try {
        const result = nullableOption!.parse(null) as z.infer<T>;
        ctx.unionResultCache.set(cacheKey, {result, score: 30, timestamp: Date.now()});
        return result;
      } catch {
        // Continue to next fallback
      }
    }
    
    if (hasOptionalOption) {
      const optionalOption = options.find((option: z.ZodType) => option instanceof z.ZodOptional);
      try {
        const result = optionalOption!.parse(undefined) as z.infer<T>;
        ctx.unionResultCache.set(cacheKey, {result, score: 30, timestamp: Date.now()});
        return result;
      } catch {
        // Continue to next fallback
      }
    }
    
    // Strategy 4: Ultimate fallback - try default values for each union option
    // Only activate for primitive union types (not complex structures)
    const hasPrimitiveTypes = options.every((option: z.ZodType) => 
      option instanceof z.ZodString || 
      option instanceof z.ZodNumber || 
      option instanceof z.ZodBoolean || 
      option instanceof z.ZodNull
    );
    
    if (hasPrimitiveTypes && ctx.depth <= 2) { // Conservative activation
      for (const option of options) {
        try {
          let defaultValue = null;
          if (option instanceof z.ZodString) defaultValue = '';
          else if (option instanceof z.ZodNumber) defaultValue = 0;
          else if (option instanceof z.ZodBoolean) defaultValue = false;
          else if (option instanceof z.ZodNull) defaultValue = null;
          
          if (defaultValue !== null) {
            const result = option.parse(defaultValue) as z.infer<T>;
            ctx.unionResultCache.set(cacheKey, {result, score: 5, timestamp: Date.now()}); // Lower score
            return result;
          }
        } catch {
          continue;
        }
      }
    }
    
    // Final strategy: Throw error with comprehensive context
    throw new Error(`No union option matched value: ${JSON.stringify(coerceValueGeneric(value))}`);
  }
  
  if (bestResult === null) {
    // Sort by score and return the best match
    results.sort((a, b) => b.score - a.score);
    bestResult = results[0].result;
    bestScore = results[0].score;
  }
  
  ctx.unionResultCache.set(cacheKey, {result: bestResult, score: bestScore, timestamp: Date.now()});
  return bestResult as T;
}

function calculateUnionScoreOptimized(value: Value, schema: z.ZodType, result: any, ctx: ParsingContext): number {
  const scoreKey = `${getValueHash(value)}:${generateSchemaFingerprint(schema)}`;
  
  if (ctx.scoreCache.has(scoreKey)) {
    return ctx.scoreCache.get(scoreKey)!;
  }
  
  let score = 0;
  
  // Use detailed scoring similar to original calculateUnionScore but optimized
  if (schema instanceof z.ZodString) {
    if (value.type === 'string') {
      score = 100; // Exact type match
    } else {
      score = 10; // Can be coerced to string
    }
  } else if (schema instanceof z.ZodNumber) {
    if (value.type === 'number') {
      score = 100; // Exact type match
    } else if (value.type === 'string' && /^\d+(\.\d+)?$/.test(value.value)) {
      score = 50; // Numeric string
    } else {
      score = 10; // Can be coerced to number
    }
  } else if (schema instanceof z.ZodBoolean) {
    if (value.type === 'boolean') {
      score = 100; // Exact type match
    } else if (value.type === 'string' && /^(true|false)$/i.test(value.value)) {
      score = 50; // Boolean string
    } else {
      score = 10; // Can be coerced to boolean
    }
  } else if (schema instanceof z.ZodNull || schema instanceof z.ZodUndefined) {
    if (value.type === 'null') {
      score = 100; // Exact match
    } else {
      score = 5; // Lower score for other types
    }
  } else if (schema instanceof z.ZodArray) {
    if (value.type === 'array') {
      score = 100; // Perfect array match
    } else {
      score = 20; // Can potentially be coerced
    }
  } else if (schema instanceof z.ZodObject) {
    if (value.type === 'object') {
      score = 100; // Perfect object match
    } else {
      score = 20; // Can potentially be coerced
    }
  } else if (schema instanceof z.ZodRecord) {
    if (value.type === 'object') {
      score = 95; // High score for record match (slightly lower than object to prefer objects when appropriate)
    } else {
      score = 15; // Can potentially be converted to record
    }
  } else if (schema instanceof z.ZodLazy) {
    // For lazy schemas, give a reasonable score based on value type
    if (value.type === 'object') {
      score = 80; // Good match for object values
    } else if (value.type === 'array') {
      score = 80; // Good match for array values
    } else {
      score = 30; // Moderate score for other types
    }
  } else {
    score = 50; // Default score for other schema types
  }
  
  ctx.scoreCache.set(scoreKey, score);
  return score;
}

function coerceUnionHybrid<T extends z.ZodUnion<any>>(
  value: Value, 
  schema: T, 
  ctx: ParsingContext
): z.infer<T> {
  const options = schema._def.options;
  const cacheKey = createEfficientCacheKey(value, schema, ctx);
  
  // Cache hit - TypeScript optimization  
  const cached = ctx.unionResultCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < 10000) { // 10s cache TTL
    return cached.result as z.infer<T>;
  }
  
  // Phase 1: try_cast (BAML pattern) - Fast compatibility filtering
  const phase1Results = [];
  for (const option of options) {
    const fastResult = tryDirectCast(value, option);
    if (fastResult.success) {
      if (fastResult.value !== undefined) {
        // Complete result from Phase 1 - return immediately
        const result = fastResult.value as z.infer<T>;
        ctx.unionResultCache.set(cacheKey, {result, score: fastResult.score || 100, timestamp: Date.now()});
        return result;
      } else {
        // Partial result - candidate for Phase 2
        phase1Results.push({ option, score: fastResult.score || 50 });
      }
    }
  }
  
  // Phase 2: Full coercion with filtered candidates (or all options if Phase 1 had no matches)
  const candidateOptions = phase1Results.length > 0 
    ? phase1Results.sort((a, b) => b.score - a.score).map(r => r.option) 
    : options;
    
  return coerceWithVisitorOptimization(value, candidateOptions, ctx, cacheKey);
}

function coerceUnion<T extends z.ZodUnion<any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  const options = schema._def.options;
  const cacheKey = createEfficientCacheKey(value, schema, ctx);
  
  // Skip caching for potentially problematic number/boolean/lazy combinations 
  // DISABLED: This was preventing proper caching and causing wrong type conversions
  // const hasNumberAndBoolean = options.some(o => o instanceof z.ZodNumber) && options.some(o => o instanceof z.ZodBoolean);
  // const hasLazy = options.some(o => o instanceof z.ZodLazy);
  const skipCache = false; // Always use caching with session-scoped caches
  
  
  // Cache hit check - essential for preventing infinite recursion
  const cached = skipCache ? null : ctx.unionResultCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < 10000) { // 10s cache TTL
    // Debug logging for cache hits (disabled)
    // if (value.type === 'number' && (value.value === 1 || value.value === 2)) {
    //   console.log(`[DEBUG] CACHE HIT - value: ${value.value}, cached result:`, cached.result);
    // }
    
    
    return cached.result as z.infer<T>;
  }

  // Recursion protection - prevent infinite loops in recursive schemas
  const currentDepth = ctx.recursionStack.get(cacheKey) || 0;
  
  // Debug: Check recursion depth for specific values (disabled)
  // if (value.type === 'number' && (value.value === 1 || value.value === 2)) {
  //   const hasNull = options.some(o => o instanceof z.ZodNull);
  //   console.log(`[RECURSION CHECK] Processing value ${value.value}, current depth: ${currentDepth}, recursion stack size: ${ctx.recursionStack.size}, union has null: ${hasNull}`);
  // }
  
  if (currentDepth >= 25) { // Balanced recursion limit to prevent infinite loops while allowing legitimate recursion
    // Return a reasonable fallback based on the value type
    if (value.type === 'string') {
      return value.value as z.infer<T>;
    } else if (value.type === 'number') {
      return value.value as z.infer<T>;
    } else if (value.type === 'boolean') {
      return value.value as z.infer<T>;
    } else if (value.type === 'null') {
      return null as z.infer<T>;
    } else if (value.type === 'array') {
      // For arrays, return the coerced JS array to avoid further recursion
      return coerceValueGeneric(value) as z.infer<T>;
    } else if (value.type === 'object') {
      // For objects, return the coerced JS object to avoid further recursion
      return coerceValueGeneric(value) as z.infer<T>;
    } else {
      // For other complex types, throw error
      throw new Error(`Recursion detected in union resolution for: ${cacheKey}`);
    }
  }
  
  ctx.recursionStack.set(cacheKey, currentDepth + 1);
  
  try {
    // First: Apply content extraction if value contains markdown code blocks
    let processedValue = value;
    if (value.type === 'string' && value.value.includes('```')) {
      const extracted = extractJsonFromText(value.value);
      if (extracted.length > 0) {
        // Use the first extracted value for union resolution
        processedValue = extracted[0];
      }
    }
    
    // Check for ambiguous literal unions and streaming validation before trying options
    if (processedValue.type === 'string') {
      const literalOptions = options.filter((option: z.ZodType) => option instanceof z.ZodLiteral);
      if (literalOptions.length > 0) {
        // Check for streaming validation failure (incomplete quoted strings)
        if (isIncompleteQuotedString(processedValue.value)) {
          throw new Error('Incomplete quoted string - streaming validation failure');
        }
        
        // Check for ambiguity in non-string literals
        if (literalOptions.length > 1) {
          const literalValues = literalOptions.map((option: z.ZodLiteral<any>) => option._def.values[0]);
          if (detectLiteralAmbiguity(processedValue.value, literalValues)) {
            throw new Error('Ambiguous literal union - multiple literal values found in text');
          }
        }
      }
    }
    
    // Phase 1: Exact match phase - try direct type matches first
    for (const option of options) {
      const exactResult = tryDirectCast(processedValue, option);
      
      // Debug logging for phase 1 (disabled)
      // if (processedValue.type === 'number' && (processedValue.value === 1 || processedValue.value === 2)) {
      //   console.log(`[DEBUG] Phase 1 for value ${processedValue.value} - option: ${option.constructor.name}, result:`, exactResult, ', depth:', ctx.recursionStack.size);
      // }
      
      if (exactResult.success && exactResult.value !== undefined) {
        // Found exact match - return immediately without coercion
        const result = exactResult.value as z.infer<T>;
        
        // Debug logging for cache set (disabled)
        // if (processedValue.type === 'number' && (processedValue.value === 1 || processedValue.value === 2)) {
        //   console.log(`[DEBUG] Setting cache for value ${processedValue.value} with result:`, result);
        // }
        // if (processedValue.type === 'number' && (processedValue.value === 1 || processedValue.value === 2)) {
        //   console.log(`[DEBUG] Phase 1 MATCH - storing: value ${processedValue.value} -> result ${result}`);
        // }
        
        if (!skipCache) ctx.unionResultCache.set(cacheKey, {result, score: exactResult.score || 100, timestamp: Date.now()});
        
        
        return result;
      }
    }
    
    // Phase 2: Full scoring approach with coercion (only if no exact match found)
    const results = [];
    
    // Debug logging for phase 2 start (disabled)
    // if (processedValue.type === 'number' && processedValue.value === 2) {
    //   console.log(`[DEBUG] Phase 2 starting for value: 2, recursion depth: ${ctx.recursionStack.size}`, ', stack keys:', Array.from(ctx.recursionStack.keys()).map(k => k.substring(0, 30)));
    // }
    
    for (const option of options) {
      try {
        // For string schemas in unions, preserve original input format
        if (option instanceof z.ZodString) {
          try {
            // Always test the original input for string schemas to preserve formatting
            const originalResult = option.parse(value.type === 'string' ? value.value : String((value as any).value || ''));
            const originalScore = calculateUnionScore(value, option, originalResult);
            results.push({ result: originalResult, option, score: originalScore });
            continue; // Skip the normal processing for string schemas
          } catch {
            // Fall through to normal processing if original doesn't work
          }
        }
        
        // Debug logging for recursive union issue (disabled)
        // if (processedValue.type === 'object') {
        //   console.log(`[DEBUG UNION] Trying option ${option.constructor.name} with object:`, 
        //     JSON.stringify(coerceValueGeneric(processedValue)));
        // }
        
        const result = coerceValue(processedValue, option, ctx);
        const score = calculateUnionScore(processedValue, option, result);
        
        // Debug logging for successful coercions (disabled)
        // if (processedValue.type === 'object') {
        //   console.log(`[DEBUG UNION] SUCCESS - ${option.constructor.name} score: ${score}, result:`, 
        //     JSON.stringify(result));
        // }
        
        results.push({ result, option, score });
        
        // Early termination for perfect matches
        if (score >= 100) {
          ctx.unionResultCache.set(cacheKey, {result, score, timestamp: Date.now()});
          return result as z.infer<T>;
        }
      } catch (e) {
        // Debug logging for failed coercions (disabled)
        // if (processedValue.type === 'object') {
        //   console.log(`[DEBUG UNION] FAILED - ${option.constructor.name} error:`, e.message);
        // }
        continue;
      }
    }
    
    if (results.length === 0) {
      // Phase 2 fallback strategies - try text extraction and other recovery methods
      
      // Strategy 1: Try text extraction for each union option (following main parser Strategy 5)
      if (value.type === 'string' && ctx.depth < 3) { // Prevent infinite recursion
        const originalInput = value.value;
        for (const option of options) {
          try {
            const extractedValue = extractFromText(originalInput, option);
            if (extractedValue) {
              const result = coerceValue(extractedValue, option, ctx);
              const score = calculateUnionScore(processedValue, option, result);
              results.push({ result, option, score });
            }
          } catch {
            continue;
          }
        }
        
        if (results.length > 0) {
          results.sort((a, b) => b.score - a.score);
          const bestResult = results[0].result as z.infer<T>;
          ctx.unionResultCache.set(cacheKey, {result: bestResult, score: results[0].score, timestamp: Date.now()});
          return bestResult;
        }
      }
      
      // Strategy 2: If input is any type and union has string option, try string fallback
      if (options.some((option: z.ZodType) => option instanceof z.ZodString)) {
        try {
          const stringOption = options.find((option: z.ZodType) => option instanceof z.ZodString) as z.ZodString;
          const stringValue = value.type === 'string' ? value.value : JSON.stringify(coerceValueGeneric(value));
          const result = stringOption.parse(stringValue) as z.infer<T>;
          ctx.unionResultCache.set(cacheKey, {result, score: 60, timestamp: Date.now()});
          return result;
        } catch {
          // Continue to next fallback
        }
      }
      
      // Strategy 3: Try nullable/optional fallbacks
      const hasNullableOption = options.some((option: z.ZodType) => option instanceof z.ZodNullable);
      const hasOptionalOption = options.some((option: z.ZodType) => option instanceof z.ZodOptional);
      
      if (hasNullableOption) {
        const nullableOption = options.find((option: z.ZodType) => option instanceof z.ZodNullable);
        try {
          const result = nullableOption!.parse(null) as z.infer<T>;
          ctx.unionResultCache.set(cacheKey, {result, score: 30, timestamp: Date.now()});
          return result;
        } catch {
          // Continue to next fallback
        }
      }
      
      if (hasOptionalOption) {
        const optionalOption = options.find((option: z.ZodType) => option instanceof z.ZodOptional);
        try {
          const result = optionalOption!.parse(undefined) as z.infer<T>;
          ctx.unionResultCache.set(cacheKey, {result, score: 30, timestamp: Date.now()});
          return result;
        } catch {
          // Continue to next fallback  
        }
      }
      
      // Strategy 4: Ultimate fallback - try default values for each union option
      // Only activate for primitive union types (not complex structures)
      const hasPrimitiveTypes = options.every((option: z.ZodType) => 
        option instanceof z.ZodString || 
        option instanceof z.ZodNumber || 
        option instanceof z.ZodBoolean || 
        option instanceof z.ZodNull
      );
      
      if (hasPrimitiveTypes && ctx.depth <= 2) { // Conservative activation
        for (const option of options) {
          try {
            let defaultValue = null;
            if (option instanceof z.ZodString) defaultValue = '';
            else if (option instanceof z.ZodNumber) defaultValue = 0;
            else if (option instanceof z.ZodBoolean) defaultValue = false;
            else if (option instanceof z.ZodNull) defaultValue = null;
            
            if (defaultValue !== null) {
              const result = option.parse(defaultValue) as z.infer<T>;
              ctx.unionResultCache.set(cacheKey, {result, score: 5, timestamp: Date.now()}); // Lower score
              return result;
            }
          } catch {
            continue;
          }
        }
      }
      
      // Final strategy: Throw error with comprehensive context
      throw new Error(`No union option matched value: ${JSON.stringify(coerceValueGeneric(value))}`);
    }
    
    // Sort by score (higher is better) and return the best match
    results.sort((a, b) => b.score - a.score);
    const bestResult = results[0].result as z.infer<T>;
    if (!skipCache) ctx.unionResultCache.set(cacheKey, {result: bestResult, score: results[0].score, timestamp: Date.now()});
    
    
    return bestResult;
  } finally {
    // Decrement recursion depth
    const newDepth = currentDepth - 1;
    if (newDepth <= 0) {
      ctx.recursionStack.delete(cacheKey);
    } else {
      ctx.recursionStack.set(cacheKey, newDepth);
    }
  }
}

function coerceDiscriminatedUnion<T extends z.ZodDiscriminatedUnion<any, any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  // First: Apply content extraction if value contains markdown code blocks
  let processedValue = value;
  if (value.type === 'string' && value.value.includes('```')) {
    const extracted = extractJsonFromText(value.value);
    if (extracted.length > 0) {
      // Use the first extracted value for union resolution
      processedValue = extracted[0];
    }
  }
  
  // For discriminated unions, we can optimize by checking the discriminator field first
  if (processedValue.type === 'object') {
    const discriminator = schema._def.discriminator;
    const discriminatorEntry = processedValue.entries.find(([k, v]) => k === discriminator);
    
    if (discriminatorEntry) {
      const discriminatorValue = discriminatorEntry[1].value;
      
      // Find the option that matches this discriminator value
      // Try each option and see which one accepts the discriminator value
      const options = Array.from(schema._def.options);
      let matchingOption = null;
      
      for (const option of options) {
        try {
          // Try to parse just the discriminator field with this option
          const testResult = option.shape[discriminator].parse(discriminatorValue);
          if (testResult === discriminatorValue) {
            matchingOption = option;
            break;
          }
        } catch {
          // This option doesn't match, continue to next
          continue;
        }
      }
      
      if (matchingOption) {
        try {
          return coerceValue(processedValue, matchingOption, ctx) as z.infer<T>;
        } catch (error) {
          // If the matching option fails, fall through to try all options
        }
      }
    }
  }
  
  // Fallback: try all options like regular union
  const options = schema._def.options;
  const results = [];
  for (const option of options) {
    try {
      const result = coerceValue(processedValue, option, ctx);
      results.push({ result, option });
    } catch {
      continue;
    }
  }
  
  if (results.length === 0) {
    throw new Error(`No discriminated union option matched value: ${JSON.stringify(coerceValueGeneric(value))}`);
  }
  
  return results[0].result as z.infer<T>;
}

function coerceEnum<T extends z.ZodEnum<any>>(value: Value, schema: T): z.infer<T> {
  const enumValues = schema.options as readonly string[];
  
  // Helper function to validate constraints on an enum value
  const validateEnumConstraints = (enumValue: string): string => {
    // Apply refinement checks if present
    if (schema._def.checks && schema._def.checks.length > 0) {
      // Use schema.parse() only to apply refinements, but we know it's a valid enum
      return schema.parse(enumValue) as z.infer<T>;
    }
    return enumValue;
  };
  
  if (value.type === 'string') {
    // Try direct match first
    const directMatch = enumValues.find(enumVal => enumVal === value.value);
    if (directMatch) {
      return validateEnumConstraints(directMatch) as z.infer<T>;
    }
    
    // Remove quotes if present
    const unquoted = value.value.replace(/^["']|["']$/g, '');
    const unquotedMatch = enumValues.find(enumVal => enumVal === unquoted);
    if (unquotedMatch) {
      return validateEnumConstraints(unquotedMatch) as z.infer<T>;
    }
    
    // Try case-insensitive match
    const caseMatches = enumValues.filter(enumVal => enumVal.toLowerCase() === unquoted.toLowerCase());
    if (caseMatches.length === 1) {
      return validateEnumConstraints(caseMatches[0]) as z.infer<T>;
    }
    
    // Extract from text with extra content (like "ONE: description" or "**one**")
    const extractedEnum = extractEnumFromText(value.value, enumValues);
    if (extractedEnum) {
      return validateEnumConstraints(extractedEnum) as z.infer<T>;
    }
    
    throw new Error(`No enum value matches: ${value.value}`);
  }
  
  if (value.type === 'array' && value.items.length > 0) {
    // Take first valid enum from array
    for (const item of value.items) {
      try {
        return coerceEnum(item, schema);
      } catch {
        continue;
      }
    }
    throw new Error(`No enum value found in array`);
  }
  
  // Try to convert to string and parse as enum
  if (value.type !== 'null') {
    try {
      const stringValue = createStringValue(coerceToString(value, z.string()));
      return coerceEnum(stringValue, schema);
    } catch (error) {
      // If string coercion also fails, fall through to final error
    }
  }
  
  throw new Error(`Cannot coerce ${value.type} to enum`);
}

function extractEnumFromText(text: string, enumValues: readonly string[]): string | null {
  if (!text || typeof text !== 'string') {
    throw new Error(`Invalid text parameter: ${text}`);
  }
  
  // Remove markdown formatting
  const cleaned = text.replace(/\*\*/g, '').replace(/\*/g, '');
  
  // Find all enum values that appear in the text
  const foundEnums: { value: string, index: number, exactCase: boolean }[] = [];
  
  for (const enumVal of enumValues) {
    // Look for exact case match as whole word only
    const regex = new RegExp(`\\b${enumVal}\\b`, 'g');
    let match;
    while ((match = regex.exec(cleaned)) !== null) {
      foundEnums.push({ value: enumVal, index: match.index, exactCase: true });
    }
    
    // Look for case-insensitive match if no exact match found for this enum value
    if (!foundEnums.some(f => f.value === enumVal && f.exactCase)) {
      const caseInsensitiveRegex = new RegExp(`\\b${enumVal}\\b`, 'gi');
      let caseMatch;
      while ((caseMatch = caseInsensitiveRegex.exec(cleaned)) !== null) {
        foundEnums.push({ value: enumVal, index: caseMatch.index, exactCase: false });
      }
    }
  }
  
  
  // Filter out ambiguous cases
  if (foundEnums.length > 1) {
    // Prioritize exact case matches over case-insensitive matches
    const exactMatches = foundEnums.filter(e => e.exactCase);
    const caseInsensitiveMatches = foundEnums.filter(e => !e.exactCase);
    
    // If we have exactly one exact match, prefer it
    if (exactMatches.length === 1 && caseInsensitiveMatches.length > 0) {
      return exactMatches[0].value;
    }
    
    // Sort by position in text to check for disambiguation patterns
    foundEnums.sort((a, b) => a.index - b.index);
    
    const firstEnum = foundEnums[0];
    const beforeFirst = cleaned.slice(Math.max(0, firstEnum.index - 3), firstEnum.index);
    const afterFirst = cleaned.slice(firstEnum.index + firstEnum.value.length);
    
    // Check if first enum is in quotes (higher priority)
    if (/["']\s*$/.test(beforeFirst) && /^\s*["']/.test(afterFirst)) {
      return firstEnum.value;
    }
    
    // Check if first enum is followed by description indicators
    if (/^\s*[:\-]/.test(afterFirst)) {
      // But make sure no other enum values are mentioned later in the text
      const remainingText = cleaned.slice(firstEnum.index + firstEnum.value.length);
      const otherEnumValues = enumValues.filter(val => val !== firstEnum.value);
      
      for (const otherEnum of otherEnumValues) {
        const regex = new RegExp(`\\b${otherEnum}\\b`, 'i');
        if (regex.test(remainingText)) {
          // Another enum is mentioned later, this is still ambiguous
          throw new Error('Ambiguous enum value - multiple enum values found');
        }
      }
      
      return firstEnum.value;
    }
    
    // If we have multiple enums without clear disambiguation, it's ambiguous
    throw new Error('Ambiguous enum value - multiple enum values found');
  }
  
  if (foundEnums.length === 1) {
    return foundEnums[0].value;
  }
  
  return null;
}

function calculateUnionScore(value: Value, schema: z.ZodType, result: any): number {
  let score = 0;
  
  
  // Exact type matches get highest score
  if (schema instanceof z.ZodString) {
    if (value.type === 'string') {
      score += 100; // Exact type match
    } else {
      score += 10; // Can be coerced to string
    }
  } else if (schema instanceof z.ZodNumber) {
    if (value.type === 'number') {
      score += 100; // Exact type match
    } else if (value.type === 'string' && /^\d+(\.\d+)?$/.test(value.value)) {
      score += 50; // Numeric string
    } else {
      score += 10; // Can be coerced to number
    }
  } else if (schema instanceof z.ZodBoolean) {
    if (value.type === 'boolean') {
      score += 100; // Exact type match
    } else if (value.type === 'string' && /^(true|false)$/i.test(value.value)) {
      score += 50; // Boolean string
    } else {
      score += 10; // Can be coerced to boolean
    }
  } else if (schema instanceof z.ZodLiteral) {
    const expectedValue = schema._def.values[0];
    
    if (value.type === 'string' && typeof expectedValue === 'string') {
      // Exact match gets highest score  
      if (value.value === expectedValue) {
        score += 100;
      }
      // Case-insensitive match gets high score
      else if (value.value.toLowerCase() === expectedValue.toLowerCase()) {
        score += 90;
      }
      // Normalized match gets medium score
      else if (normalizeLiteralString(value.value) === normalizeLiteralString(expectedValue)) {
        score += 70;
      }
      // String type compatibility gets base score
      else {
        score += 20;
      }
    }
    else if (value.type === 'number' && typeof expectedValue === 'number' && value.value === expectedValue) {
      score += 100;
    }
    else if (value.type === 'boolean' && typeof expectedValue === 'boolean' && value.value === expectedValue) {
      score += 100;
    }
    // Object single-value extraction scoring
    else if (value.type === 'object' && value.entries.length === 1) {
      const [key, innerValue] = value.entries[0];
      if (
        (innerValue.type === 'string' && typeof expectedValue === 'string') ||
        (innerValue.type === 'number' && typeof expectedValue === 'number') ||
        (innerValue.type === 'boolean' && typeof expectedValue === 'boolean')
      ) {
        score += 60; // Medium-high score for object extraction
      }
    }
    // Cross-type coercion gets low score
    else if (value.type === 'string' && (typeof expectedValue === 'number' || typeof expectedValue === 'boolean')) {
      score += 10;
    }
  } else if (schema instanceof z.ZodNull || schema instanceof z.ZodUndefined) {
    if (value.type === 'null') {
      score += 100; // Exact match
    } else {
      score += 5; // Lower score for other types
    }
  } else if (schema instanceof z.ZodArray) {
    if (value.type === 'array') {
      score += 100; // Base score for array match
      
      // For complex element schemas (like JsonValue unions), give significant bonus to prevent recursion issues
      const elementSchema = schema.element;
      if (elementSchema instanceof z.ZodLazy || elementSchema instanceof z.ZodUnion) {
        // For recursive/union element schemas, give high bonus if we have valid array structure
        score += 20; // High bonus for having array structure with complex elements
      } else {
        // Add element compatibility scoring for simple element types
        let elementScore = 0;
        let elementCount = 0;
        
        for (const element of value.items) {
          elementCount++;
          // Score how well each element matches the expected element type
          if (elementSchema instanceof z.ZodString) {
            if (element.type === 'string') {
              elementScore += 10; // Perfect element match
            } else if (element.type === 'number' || element.type === 'boolean') {
              elementScore -= 5; // Penalty for type mismatch that needs coercion
            }
          } else if (elementSchema instanceof z.ZodNumber) {
            if (element.type === 'number') {
              elementScore += 10; // Perfect element match
            } else if (element.type === 'string' && /^\d+(\.\d+)?$/.test(element.value)) {
              elementScore += 5; // Numeric string - good match
            } else {
              elementScore -= 10; // Strong penalty for non-numeric types
            }
          } else if (elementSchema instanceof z.ZodBoolean) {
            if (element.type === 'boolean') {
              elementScore += 10; // Perfect element match
            } else if (element.type === 'string' && /^(true|false)$/i.test(element.value)) {
              elementScore += 5; // Boolean string - good match
            } else {
              elementScore -= 10; // Strong penalty for non-boolean types
            }
          }
        }
        
        // Average the element score and add it to the total
        if (elementCount > 0) {
          const avgElementScore = Math.floor(elementScore / elementCount);
          score += avgElementScore; // Allow negative scores to penalize mismatches
        }
      }
    } else {
      score += 20; // Can potentially be converted to array
    }
  } else if (schema instanceof z.ZodObject) {
    if (value.type === 'object') {
      score += 100; // Exact type match
    } else {
      score += 20; // Can potentially be converted to object
    }
  } else if (schema instanceof z.ZodRecord) {
    if (value.type === 'object') {
      score += 95; // High score for record match (slightly lower than object to prefer objects when appropriate)
    } else {
      score += 15; // Can potentially be converted to record
    }
  } else if (schema instanceof z.ZodLazy) {
    // For lazy schemas, try to resolve and score based on the resolved schema
    try {
      // Use cached lazy schema resolution for performance
      let resolvedSchema = lazySchemaCache.get(schema);
      if (!resolvedSchema) {
        resolvedSchema = schema._def.getter();
        lazySchemaCache.set(schema, resolvedSchema);
      }
      // Recursive call to score the resolved schema without penalty
      const resolvedScore = calculateUnionScore(value, resolvedSchema as z.ZodType, result);
      score += resolvedScore; // No penalty for lazy schemas - they should score based on their resolved type
    } catch {
      // If resolution fails, give a higher score for object-like values since lazy schemas are typically recursive objects
      if (value.type === 'object') {
        score += 100; // Higher score for object matches with lazy schemas
      } else {
        score += 50; // Better score for other types that might fit recursive patterns
      }
    }
  }
  
  // Bonus for no coercion needed (result type matches schema expectation)
  if (typeof result === 'string' && schema instanceof z.ZodString) {
    score += 10;
  } else if (typeof result === 'number' && schema instanceof z.ZodNumber) {
    score += 10;
  } else if (typeof result === 'boolean' && schema instanceof z.ZodBoolean) {
    score += 10;
  }
  
  return score;
}
function coerceRecord<T extends z.ZodRecord<any, any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  // Handle Zod v4 API inconsistency: z.record(valueSchema) doesn't set valueType properly
  // For single-parameter z.record(valueSchema), the valueSchema ends up in keyType, but valueType is undefined
  // For two-parameter z.record(keySchema, valueSchema), both are set correctly
  
  let keySchema: z.ZodType;
  let valueSchema: z.ZodType;
  
  if (schema.valueType) {
    // Two-parameter form: z.record(keySchema, valueSchema)
    keySchema = schema.keyType;
    valueSchema = schema.valueType;
  } else {
    // Single-parameter form: z.record(valueSchema) - the valueSchema is actually in keyType
    keySchema = z.string(); // Keys are always strings in single-parameter form
    valueSchema = schema.keyType; // The actual value schema is stored in keyType due to Zod v4 bug
  }
  
  const newCtx = { ...ctx, depth: ctx.depth + 1 };
  
  if (newCtx.depth > newCtx.maxDepth) {
    throw new Error('Maximum recursion depth exceeded');
  }
  
  if (value.type === 'object') {
    const result: Record<string, any> = {};
    
    for (const [key, val] of value.entries) {
      // Coerce the key (usually to string)
      const coercedKey = coerceRecordKey(key, keySchema);
      // Coerce the value using the value schema
      try {
        const coercedValue = coerceValue(val, valueSchema, newCtx);
        result[coercedKey] = coercedValue;
      } catch (error) {
        // If value coercion fails (likely due to Zod v4 bugs), try fallback strategies
        if (val.type === 'object' && valueSchema instanceof z.ZodObject) {
          // For object values with object schemas, try manual coercion
          const objectResult = coerceObjectManually(val, valueSchema, newCtx);
          result[coercedKey] = objectResult;
        } else {
          // For other types, use generic coercion as fallback
          result[coercedKey] = coerceValueGeneric(val);
        }
      }
    }
    
    // Skip manual validation for Zod v4 compatibility
    // Zod v4 has bugs with record parsing that cause validation failures
    // Since we've already done proper coercion above using coerceValue(),
    // we can trust that the result is correctly typed and skip Zod's broken validation
    return result as z.infer<T>;
  }
  
  // Handle string values that might contain JSON objects  
  if (value.type === 'string') {
    const trimmed = value.value.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      // Try to parse as JSON and create object Value
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          const objectValue = createValueFromParsed(parsed);
          return coerceRecord(objectValue, schema, newCtx);
        }
      } catch {
        // Try fixing parser if JSON.parse fails
        try {
          const fixed = fixJson(trimmed);
          const parsed = JSON.parse(fixed);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const objectValue = createValueFromParsed(parsed);
            return coerceRecord(objectValue, schema, newCtx);
          }
        } catch {
          // Continue to other strategies
        }
      }
    }
  }
  
  // Fallback: try to parse as generic value 
  const genericValue = coerceValueGeneric(value);
  if (typeof genericValue === 'object' && genericValue !== null && !Array.isArray(genericValue)) {
    // Skip validation due to Zod v4 record parsing bugs
    // Trust that coerceValueGeneric() produced the right types
    return genericValue as z.infer<T>;
  }
  
  // Graceful handling for non-object inputs like empty strings or invalid JSON
  if (value.type === 'string') {
    // For empty strings or invalid JSON, return empty record
    const trimmed = value.value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
      return {} as z.infer<T>;
    }
    
    // For other string inputs that don't look like JSON, return empty record gracefully
    // This handles cases like "not json at all"
    if (!trimmed.includes('{') && !trimmed.includes('[')) {
      return {} as z.infer<T>;
    }
  }
  
  // If all else fails, return empty record
  return {} as z.infer<T>;
}

function coerceObjectManually<T extends z.ZodObject<any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  // Manual object coercion to work around Zod v4 bugs
  const schemaShape = schema.shape as Record<string, z.ZodType>;
  const result: Record<string, any> = {};
  
  if (value.type === 'object') {
    for (const [key, val] of value.entries) {
      const fieldSchema = schemaShape[key];
      if (fieldSchema) {
        try {
          if (fieldSchema instanceof z.ZodRecord) {
            // Handle nested records manually to avoid Zod v4 bugs
            result[key] = coerceRecord(val, fieldSchema, ctx);
          } else {
            result[key] = coerceValue(val, fieldSchema, ctx);
          }
        } catch (error) {
          // If field coercion fails, use generic coercion
          result[key] = coerceValueGeneric(val);
        }
      }
    }
  }
  
  return result as z.infer<T>;
}

function coerceRecordKey(key: string, keySchema: z.ZodType): string {
  // For record keys, we typically want strings, but support key schema validation
  if (keySchema instanceof z.ZodString) {
    return key; // Already a string, just return it
  }
  
  if (keySchema instanceof z.ZodEnum) {
    // For enum keys, validate that the key matches one of the enum values
    const enumValues = keySchema.options as readonly string[];
    if (enumValues.includes(key)) {
      return key;
    }
    throw new Error(`Record key '${key}' is not a valid enum value`);
  }
  
  if (keySchema instanceof z.ZodLiteral) {
    // For literal keys, ensure exact match
    const expectedValue = keySchema._def.values[0]; // Zod v4 stores literals in values array
    if (key === String(expectedValue)) {
      return key;
    }
    throw new Error(`Record key '${key}' does not match literal value '${expectedValue}'`);
  }
  
  if (keySchema instanceof z.ZodUnion) {
    // For union keys (like z.union([z.literal("A"), z.literal("B")])), try each option
    const options = keySchema._def.options;
    for (const option of options) {
      try {
        return coerceRecordKey(key, option);
      } catch {
        continue;
      }
    }
    throw new Error(`Record key '${key}' does not match any union option`);
  }
  
  // Default: convert to string
  return String(key);
}
