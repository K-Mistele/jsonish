import { z } from 'zod';
import { Value, createStringValue, createValueFromParsed } from './value.js';
import { coerceToString, coerceToNumber, coerceToBoolean, coerceLiteral, isSchemaType, normalizeLiteralString, extractFromText, detectLiteralAmbiguity, isIncompleteQuotedString } from './coercer.js';
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
  
  // Special handling for unions containing string schemas to preserve formatting
  if (schema instanceof z.ZodUnion) {
    const options = schema._def.options;
    const hasStringOption = options.some((option: z.ZodType) => option instanceof z.ZodString);
    const hasArrayOption = options.some((option: z.ZodType) => option instanceof z.ZodArray);
    const hasObjectOption = options.some((option: z.ZodType) => option instanceof z.ZodObject);
    
    if (hasStringOption && !hasArrayOption && !hasObjectOption && input.startsWith('"') && input.endsWith('"')) {
      // Only skip JSON.parse for inputs that look like JSON-quoted strings
      // AND only if the union contains only primitive types (no complex structures)
      const stringValue = createStringValue(input);
      return coerceUnion(stringValue, schema, ctx) as z.infer<T>;
    }
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
  if (schema instanceof z.ZodObject || schema instanceof z.ZodArray || schema instanceof z.ZodRecord) {
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
  if (schema instanceof z.ZodObject || schema instanceof z.ZodArray || schema instanceof z.ZodRecord) {
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
  if (options?.allowPartial && (schema instanceof z.ZodObject || schema instanceof z.ZodArray || schema instanceof z.ZodRecord)) {
    try {
      return parsePartialValue(input, schema, ctx);
    } catch {
      // Continue to string fallback if partial parsing fails
    }
  }
  
  // Strategy 7: String fallback with type coercion
  console.log('DEBUG Strategy 7 - input:', JSON.stringify(input));
  const stringValue = createStringValue(input);
  console.log('DEBUG Strategy 7 - stringValue.value:', JSON.stringify(stringValue.value));
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

// Parsing context for circular reference detection
export interface ParsingContext {
  visitedClassValuePairs: Set<string>;
  visitedLazySchemas?: Set<string>;
  depth: number;
  maxDepth: number;
}

export function createParsingContext(): ParsingContext {
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
  
  if (schema instanceof z.ZodLiteral) {
    return coerceLiteral(value, schema, ctx) as z.infer<T>;
  }
  
  if (schema instanceof z.ZodRecord) {
    return coerceRecord(value, schema, ctx) as z.infer<T>;
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
  
  // Try all union options and pick the best match using scoring system
  const results = [];
  for (const option of options) {
    try {
      // For string schemas in unions, preserve original input format
      if (option instanceof z.ZodString) {
        try {
          // Always test the original input for string schemas to preserve formatting
          const originalResult = option.parse(value.value);
          const originalScore = calculateUnionScore(value, option, originalResult);
          results.push({ result: originalResult, option, score: originalScore });
          continue; // Skip the normal processing for string schemas
        } catch {
          // Fall through to normal processing if original doesn't work
        }
      }
      
      const result = coerceValue(processedValue, option, ctx);
      const score = calculateUnionScore(processedValue, option, result);
      results.push({ result, option, score });
    } catch (e) {
      continue;
    }
  }
  
  if (results.length === 0) {
    // Try fallback strategies before throwing
    
    // Strategy 1: If input is complex (object/array) and union has string option, try string fallback
    if ((value.type === 'object' || value.type === 'array') && options.some((option: z.ZodType) => option instanceof z.ZodString)) {
      try {
        const stringOption = options.find((option: z.ZodType) => option instanceof z.ZodString) as z.ZodString;
        const stringValue = JSON.stringify(coerceValueGeneric(value));
        return stringOption.parse(stringValue) as z.infer<T>;
      } catch {
        // Continue to next fallback
      }
    }
    
    // Strategy 2: Try to coerce the value to each type more aggressively
    for (const option of options) {
      try {
        if (option instanceof z.ZodString) {
          // Try to convert any value to string
          const stringVal = String(coerceValueGeneric(value));
          return option.parse(stringVal) as z.infer<T>;
        } else if (option instanceof z.ZodNumber) {
          // Try to extract numbers from strings
          if (value.type === 'string') {
            const numberMatch = value.value.match(/[-+]?\d*\.?\d+/);
            if (numberMatch) {
              const num = parseFloat(numberMatch[0]);
              if (!isNaN(num)) {
                return option.parse(num) as z.infer<T>;
              }
            }
          }
        } else if (option instanceof z.ZodBoolean) {
          // Try to infer boolean from strings
          if (value.type === 'string') {
            const lowerVal = value.value.toLowerCase().trim();
            if (lowerVal.includes('true') || lowerVal.includes('yes')) {
              return option.parse(true) as z.infer<T>;
            } else if (lowerVal.includes('false') || lowerVal.includes('no')) {
              return option.parse(false) as z.infer<T>;
            }
          }
        }
      } catch {
        continue;
      }
    }
    
    // Strategy 3: Last resort - try to return a reasonable default
    // For number unions, try to parse as 0 if nothing else works
    if (options.some((option: z.ZodType) => option instanceof z.ZodNumber)) {
      try {
        const numberOption = options.find((option: z.ZodType) => option instanceof z.ZodNumber) as z.ZodNumber;
        return numberOption.parse(0) as z.infer<T>;
      } catch {
        // Continue
      }
    }
    
    // For boolean unions, try to return false as default
    if (options.some((option: z.ZodType) => option instanceof z.ZodBoolean)) {
      try {
        const booleanOption = options.find((option: z.ZodType) => option instanceof z.ZodBoolean) as z.ZodBoolean;
        return booleanOption.parse(false) as z.infer<T>;
      } catch {
        // Continue  
      }
    }
    
    // If all fallback strategies fail, throw error
    throw new Error(`No union option matched value: ${JSON.stringify(coerceValueGeneric(value))}`);
  }
  
  // Sort by score (higher is better) and return the best match
  results.sort((a, b) => b.score - a.score);
  return results[0].result as z.infer<T>;
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
      const options = schema._def.options as Map<any, z.ZodObject<any>>;
      const matchingOption = options.get(discriminatorValue);
      
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
  const options = Array.from(schema._def.options.values());
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
      
      // Add element compatibility scoring
      const elementSchema = schema.element;
      let elementScore = 0;
      let elementCount = 0;
      
      for (const element of value.items) {
        elementCount++;
        // Score how well each element matches the expected element type
        if (elementSchema instanceof z.ZodString) {
          if (element.type === 'string') {
            elementScore += 10; // Perfect element match
          } else if (element.type === 'number' || element.type === 'boolean') {
            elementScore += 1; // Can be coerced but not ideal
          }
        } else if (elementSchema instanceof z.ZodNumber) {
          if (element.type === 'number') {
            elementScore += 10; // Perfect element match
          } else if (element.type === 'string' && /^\d+(\.\d+)?$/.test(element.value)) {
            elementScore += 5; // Numeric string - good match
          } else {
            elementScore -= 5; // Poor element match
          }
        } else if (elementSchema instanceof z.ZodBoolean) {
          if (element.type === 'boolean') {
            elementScore += 10; // Perfect element match
          } else if (element.type === 'string' && /^(true|false)$/i.test(element.value)) {
            elementScore += 5; // Boolean string - good match
          } else {
            elementScore -= 5; // Poor element match
          }
        }
      }
      
      // Average the element score and add it to the total
      if (elementCount > 0) {
        score += Math.floor(elementScore / elementCount);
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
      const coercedValue = coerceValue(val, valueSchema, newCtx);
      result[coercedKey] = coercedValue;
    }
    
    // Manual validation since Zod v4 record parsing is broken
    // For keys, we can validate directly since they should be strings/enums/literals
    // For values, we need to avoid direct .parse() if the valueSchema is a Record (due to Zod v4 bug)
    for (const [key, val] of Object.entries(result)) {
      keySchema.parse(key); // Validate key - should be safe
      
      // For value validation, check if it's already been coerced properly
      // Since we used coerceValue() above, the values should already be correct
      // Only validate primitive value types to avoid Zod v4 record parse issues
      if (valueSchema instanceof z.ZodString || 
          valueSchema instanceof z.ZodNumber || 
          valueSchema instanceof z.ZodBoolean || 
          valueSchema instanceof z.ZodEnum ||
          valueSchema instanceof z.ZodLiteral) {
        valueSchema.parse(val); // Safe to validate primitive types
      }
      // For complex types (ZodRecord, ZodObject, ZodArray), trust that coerceValue did the right thing
    }
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
  
  // Fallback: try to parse as generic value and handle Zod validation manually
  const genericValue = coerceValueGeneric(value);
  if (typeof genericValue === 'object' && genericValue !== null && !Array.isArray(genericValue)) {
    // Manual validation since Zod v4 record parsing is broken
    for (const [key, val] of Object.entries(genericValue)) {
      keySchema.parse(key); // Validate key - should be safe
      
      // For value validation, only validate primitive types to avoid Zod v4 record parse issues
      if (valueSchema instanceof z.ZodString || 
          valueSchema instanceof z.ZodNumber || 
          valueSchema instanceof z.ZodBoolean || 
          valueSchema instanceof z.ZodEnum ||
          valueSchema instanceof z.ZodLiteral) {
        valueSchema.parse(val); // Safe to validate primitive types
      }
      // For complex types (ZodRecord, ZodObject, ZodArray), trust the generic coercion
    }
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
