import { z } from 'zod';
import { Value, createStringValue, createValueFromParsed } from './value.js';
import { coerceToString, coerceToNumber, coerceToBoolean, extractFromText, isSchemaType } from './coercer.js';
import { fixJson, parseWithAdvancedFixing } from './fixing-parser.js';
import { extractJsonFromText, extractMultipleObjects } from './extractors.js';
import type { ParseOptions } from './index.js';

// Semantic alias mappings for field names
const SEMANTIC_ALIASES: Record<string, string[]> = {
  'signature': ['function_signature', 'func_signature', 'method_signature'],
  'description': ['desc', 'details', 'summary'],
  'properties': ['props', 'attributes', 'fields'],
};

export function parseBasic<T extends z.ZodType>(input: string, schema: T, options?: ParseOptions): z.infer<T> {
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
  
  // Strategy 6: Partial parsing for incomplete JSON (if allowPartial is enabled)
  if (options?.allowPartial && (schema instanceof z.ZodObject || schema instanceof z.ZodArray)) {
    try {
      return parsePartialValue(input, schema, ctx);
    } catch {
      // Continue to string fallback if partial parsing fails
    }
  }
  
  // Strategy 7: String fallback with type coercion
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
  
  throw new Error('Partial parsing only supported for objects and arrays');
}

function parsePartialObject<T extends z.ZodObject<any>>(input: string, schema: T, ctx: ParsingContext): z.infer<T> {
  const shape = schema.shape;
  const result: Record<string, any> = {};
  
  // Try to extract whatever JSON we can from the incomplete input
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
  
  // Fill the result with available data and defaults for missing fields
  for (const [key, fieldSchema] of Object.entries(shape)) {
    if (key in partialData) {
      try {
        // Try to coerce the available value
        const partialValue = createValueFromParsed(partialData[key]);
        result[key] = coerceValue(partialValue, fieldSchema as z.ZodType, ctx);
      } catch {
        // If direct coercion fails, try partial parsing for complex types
        if (fieldSchema instanceof z.ZodArray && partialData[key] && Array.isArray(partialData[key])) {
          // Check if the original input has incomplete array elements for this field
          // If so, return empty array instead of attempting partial parsing
          if (hasIncompleteArrayElementsForField(input, key)) {
            result[key] = [];
          } else {
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
          }
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
  // Check if the array contains incomplete/truncated objects
  // If so, return empty array rather than attempting partial parsing
  if (hasIncompleteArrayElements(input)) {
    return [] as z.infer<T>;
  }
  
  // For partial arrays, return empty array if we can't parse anything
  try {
    // Try to extract objects from the incomplete array
    const objects = extractMultipleObjects(input);
    const validObjects = objects.filter(obj => {
      try {
        coerceValue(obj, schema.element, ctx);
        return true;
      } catch {
        return false;
      }
    });
    
    return validObjects.map(obj => coerceValue(obj, schema.element, ctx)) as z.infer<T>;
  } catch {
    // Return empty array if we can't parse anything
    return [] as z.infer<T>;
  }
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
  
  if (schema instanceof z.ZodDiscriminatedUnion) {
    return coerceDiscriminatedUnion(value, schema, ctx) as z.infer<T>;
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
  
  // Handle wrapped schemas (Optional, Nullable, etc.)
  if (schema instanceof z.ZodOptional) {
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
    // For nullable enum schemas, check for explicit JSON null first
    if (value.type === 'string' && schema._def.innerType instanceof z.ZodEnum) {
      if (/```json\s*null\s*```/i.test(value.value)) {
        return null as z.infer<T>;
      }
    }
    
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
  
  // Try all union options and pick the best match using scoring system
  const results = [];
  for (const option of options) {
    try {
      const result = coerceValue(value, option, ctx);
      const score = calculateUnionScore(value, option, result);
      results.push({ result, option, score });
    } catch {
      continue;
    }
  }
  
  if (results.length === 0) {
    throw new Error(`No union option matched value: ${JSON.stringify(coerceValueGeneric(value))}`);
  }
  
  // Sort by score (higher is better) and return the best match
  results.sort((a, b) => b.score - a.score);
  return results[0].result as z.infer<T>;
}

function coerceDiscriminatedUnion<T extends z.ZodDiscriminatedUnion<any, any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  // For discriminated unions, we can optimize by checking the discriminator field first
  if (value.type === 'object') {
    const discriminator = schema._def.discriminator;
    const discriminatorEntry = value.entries.find(([k, v]) => k === discriminator);
    
    if (discriminatorEntry) {
      const discriminatorValue = discriminatorEntry[1].value;
      
      // Find the option that matches this discriminator value
      const options = schema._def.options as Map<any, z.ZodObject<any>>;
      const matchingOption = options.get(discriminatorValue);
      
      if (matchingOption) {
        try {
          return coerceValue(value, matchingOption, ctx) as z.infer<T>;
        } catch (error) {
          // If the matching option fails, fall through to try all options
        }
      }
    }
  }
  
  // Fallback: try all options like regular union
  const options = Array.from(schema._def.options.values());
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
    throw new Error(`No discriminated union option matched value: ${JSON.stringify(coerceValueGeneric(value))}`);
  }
  
  return results[0].result as z.infer<T>;
}

function coerceEnum<T extends z.ZodEnum<any>>(value: Value, schema: T): z.infer<T> {
  const enumValues = schema.options as readonly string[];
  
  if (value.type === 'string') {
    // Try direct match first
    const directMatch = enumValues.find(enumVal => enumVal === value.value);
    if (directMatch) {
      return directMatch as z.infer<T>;
    }
    
    // Remove quotes if present
    const unquoted = value.value.replace(/^["']|["']$/g, '');
    const unquotedMatch = enumValues.find(enumVal => enumVal === unquoted);
    if (unquotedMatch) {
      return unquotedMatch as z.infer<T>;
    }
    
    // Try case-insensitive match
    const caseMatches = enumValues.filter(enumVal => enumVal.toLowerCase() === unquoted.toLowerCase());
    if (caseMatches.length === 1) {
      return caseMatches[0] as z.infer<T>;
    }
    
    // Extract from text with extra content (like "ONE: description" or "**one**")
    const extractedEnum = extractEnumFromText(value.value, enumValues);
    if (extractedEnum) {
      return extractedEnum as z.infer<T>;
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
  } else if (schema instanceof z.ZodNull || schema instanceof z.ZodUndefined) {
    if (value.type === 'null') {
      score += 100; // Exact match
    } else {
      score += 5; // Lower score for other types
    }
  } else if (schema instanceof z.ZodArray) {
    if (value.type === 'array') {
      score += 100; // Exact type match
    } else {
      score += 20; // Can potentially be converted to array
    }
  } else if (schema instanceof z.ZodObject) {
    if (value.type === 'object') {
      score += 100; // Exact type match
    } else {
      score += 20; // Can potentially be converted to object
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