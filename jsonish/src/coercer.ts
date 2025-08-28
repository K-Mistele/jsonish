import { z } from 'zod';
import { Value, createStringValue, createNumberValue, createBooleanValue } from './value.js';
import { ParsingContext, createParsingContext } from './parser.js';

export function coerceToString(value: Value, schema: z.ZodString): string {
  switch (value.type) {
    case 'string':
      return value.value;
    case 'number':
      return value.value.toString();
    case 'boolean':
      return value.value.toString();
    case 'object':
      // Convert object to TypeScript interface string representation  
      const objectProps = [];
      for (const [key, val] of value.entries) {
        const valStr = getValueAsJavaScript(val);
        if (typeof valStr === 'string') {
          objectProps.push(`${key}: ${valStr}`);
        } else {
          objectProps.push(`${key}: ${JSON.stringify(valStr)}`);
        }
      }
      return `{${objectProps.join(', ')}}`;
    case 'null':
      return 'null';
    case 'array':
      // Convert array to JSON string representation
      const arrayValues = value.items.map((element: Value) => getValueAsJavaScript(element));
      return JSON.stringify(arrayValues);
    default:
      throw new Error(`Cannot coerce ${value.type} to string`);
  }
}

export function coerceToNumber(value: Value, schema: z.ZodNumber): number {
  switch (value.type) {
    case 'number':
      return value.value;
    case 'string':
      return parseNumberFromString(value.value);
    case 'boolean':
      return value.value ? 1 : 0;
    default:
      throw new Error(`Cannot coerce ${value.type} to number`);
  }
}

export function coerceToBoolean(value: Value, schema: z.ZodBoolean): boolean {
  switch (value.type) {
    case 'boolean':
      return value.value;
    case 'string':
      return parseBooleanFromString(value.value);
    case 'number':
      return value.value !== 0;
    default:
      throw new Error(`Cannot coerce ${value.type} to boolean`);
  }
}

function parseNumberFromString(str: string): number {
  // Handle comma-separated: "1,234.56" → 1234.56
  const cleaned = str.replace(/,/g, '');
  
  // Handle currency: "$1234.56" → 1234.56
  const noCurrency = cleaned.replace(/^\$/, '');
  
  // Handle fractions: "1/5" → 0.2
  if (noCurrency.includes('/')) {
    const parts = noCurrency.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const denom = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
        return num / denom;
      }
    }
  }
  
  // Handle trailing dots: "12.11." → 12.11
  const noDots = noCurrency.replace(/\.$/, '');
  
  const result = parseFloat(noDots);
  if (isNaN(result)) {
    throw new Error(`Cannot parse number from: ${str}`);
  }
  
  return result;
}

function parseBooleanFromString(str: string): boolean {
  // Case-insensitive boolean parsing
  const lower = str.toLowerCase().trim();
  
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  
  // Check for markdown formatting like "**True**"
  const cleaned = str.replace(/\*\*/g, '').toLowerCase().trim();
  if (cleaned === 'true') return true;
  if (cleaned === 'false') return false;
  
  // Extract from text: "The answer is true" → true
  const hasTrue = /\btrue\b/i.test(str);
  const hasFalse = /\bfalse\b/i.test(str);
  
  if (hasTrue && hasFalse) {
    throw new Error('Ambiguous boolean value');
  }
  
  if (hasTrue) return true;
  if (hasFalse) return false;
  
  throw new Error(`Cannot parse boolean from: ${str}`);
}

export function extractFromText(input: string, schema: z.ZodType): Value | null {
  // Extract numbers from text only if there's actual text around the number
  if (schema instanceof z.ZodNumber) {
    // Only extract if there's text before or after the number (not just the number itself)
    const trimmed = input.trim();
    // Check if it looks like a standalone number (including formats like currency, fractions, commas)
    const standalonePattern = /^[\$]?[\d,]+(?:\.[\d,]+)?(?:\/\d+)?\.?$/;
    if (standalonePattern.test(trimmed)) {
      // This is just a number by itself (possibly formatted), let string coercion handle it
      return null;
    }
    
    // Extract from text with surrounding words: "1 cup butter" → 1
    const textMatch = input.match(/\d+(?:\.\d+)?/);
    if (textMatch) {
      const num = parseFloat(textMatch[0]);
      return createNumberValue(num);
    }
  }
  
  // Extract booleans: "The answer is true" → true
  if (schema instanceof z.ZodBoolean) {
    const hasTrue = /\btrue\b/i.test(input);
    const hasFalse = /\bfalse\b/i.test(input);
    
    if (hasTrue && hasFalse) {
      // Ambiguous case - should throw
      throw new Error('Ambiguous boolean value');
    }
    
    if (hasTrue) {
      return createBooleanValue(true);
    }
    
    if (hasFalse) {
      return createBooleanValue(false);
    }
  }
  
  // Extract enums from text: "The answer is ONE" → "ONE"
  if (schema instanceof z.ZodEnum) {
    const enumValues = schema.options as readonly string[];
    const extractedEnum = extractEnumFromText(input, enumValues);
    if (extractedEnum) {
      return createStringValue(extractedEnum);
    }
  }
  
  // Handle wrapped schemas (Optional, Nullable)
  if (schema instanceof z.ZodOptional) {
    // For optional schemas, check if there's explicit JSON null first
    if (/```json\s*null\s*```/i.test(input)) {
      return null; // Return null to indicate "no value found" for optional
    }
    return extractFromText(input, schema._def.innerType);
  }
  
  if (schema instanceof z.ZodNullable) {
    // For nullable schemas, check if there's explicit JSON null first
    if (/```json\s*null\s*```/i.test(input)) {
      return null; // Return null to indicate explicit null
    }
    return extractFromText(input, schema._def.innerType);
  }
  
  return null;
}

export function isSchemaType<T extends z.ZodType>(schema: z.ZodType, type: new (...args: any[]) => T): schema is T {
  return schema instanceof type;
}

function getValueAsJavaScript(value: Value): any {
  switch (value.type) {
    case 'string':
      return value.value;
    case 'number':
      return value.value;
    case 'boolean':
      return value.value;
    case 'null':
      return null;
    case 'object':
      const obj: Record<string, any> = {};
      for (const [key, val] of value.entries) {
        obj[key] = getValueAsJavaScript(val);
      }
      return obj;
    case 'array':
      return value.items.map(element => getValueAsJavaScript(element));
    default:
      return null;
  }
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
    
    // If we have exactly one exact match and only case-insensitive matches for other values, prefer the exact match
    if (exactMatches.length === 1 && caseInsensitiveMatches.length > 0) {
      return exactMatches[0].value;
    }
    
    // If all matches are case-insensitive, it's ambiguous
    if (exactMatches.length === 0 && caseInsensitiveMatches.length > 1) {
      throw new Error('Ambiguous enum value - multiple enum values found');
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

function valueToTypeScriptString(value: Value): string {
  switch (value.type) {
    case 'string':
      // Don't add quotes - return the string value as-is for TypeScript interface syntax
      return value.value;
    case 'number':
      return value.value.toString();
    case 'boolean':
      return value.value.toString();
    case 'null':
      return 'null';
    case 'object':
      const objectPairs: string[] = [];
      for (const [key, val] of value.entries) {
        const valueStr = valueToTypeScriptString(val);
        objectPairs.push(`${key}: ${valueStr}`);
      }
      return `{${objectPairs.join(', ')}}`;
    case 'array':
      const arrayValues = value.items.map(element => valueToTypeScriptString(element));
      return `[${arrayValues.join(', ')}]`;
    default:
      return 'unknown';
  }
}

export function coerceLiteral<T extends z.ZodLiteral<any>>(
  value: Value, 
  schema: T, 
  ctx: ParsingContext = createParsingContext()
): z.infer<T> {
  const expectedValue = schema._def.values[0];
  
  // Object single-value extraction (following Rust implementation)
  // Only extract from objects with exactly one key, and only for primitive values
  if (value.type === 'object' && value.entries.length === 1) {
    const [key, innerValue] = value.entries[0];
    if (innerValue.type === 'number' || innerValue.type === 'boolean' || innerValue.type === 'string') {
      // Recursively coerce the extracted value
      try {
        return coerceLiteral(innerValue, schema, ctx);
      } catch {
        // If coercion fails, fall through to other strategies
      }
    }
  }

  // Handle string literals with advanced matching
  if (typeof expectedValue === 'string' && value.type === 'string') {
    const result = matchStringLiteral(value.value, expectedValue);
    if (result !== null) {
      return result as z.infer<T>;
    }
  }
  
  // Text extraction fallback for string values (but not for JSON-like strings)
  if (value.type === 'string' && !looksLikeJson(value.value)) {
    const extracted = extractLiteralFromText(value.value, expectedValue);
    if (extracted !== null) {
      return extracted as z.infer<T>;
    }
  }
  
  // Exact matching for numbers and booleans
  if (value.type === 'number' && typeof expectedValue === 'number' && value.value === expectedValue) {
    return expectedValue as z.infer<T>;
  }
  
  if (value.type === 'boolean' && typeof expectedValue === 'boolean' && value.value === expectedValue) {
    return expectedValue as z.infer<T>;
  }
  
  throw new Error(`Cannot coerce ${JSON.stringify(getValueAsJavaScript(value))} to literal ${JSON.stringify(expectedValue)}`);
}

function matchStringLiteral(input: string, expected: string): string | null {
  // Layer 1: Exact case-sensitive match (highest priority)
  if (input === expected) {
    return expected;
  }
  
  // Streaming validation: Check for incomplete quoted strings
  if (isIncompleteQuotedString(input)) {
    throw new Error('Incomplete quoted string - streaming validation failure');
  }
  
  // Layer 2: Remove quotes and try again
  const cleanInput = input.replace(/^["']|["']$/g, '');
  if (cleanInput === expected) {
    return expected;
  }
  
  // Layer 3: Case-insensitive match
  if (cleanInput.toLowerCase() === expected.toLowerCase()) {
    return expected; // Return expected case, not input case
  }
  
  // Layer 4: Punctuation stripping + case-insensitive
  const normalizedInput = normalizeLiteralString(cleanInput);
  const normalizedExpected = normalizeLiteralString(expected);
  if (normalizedInput === normalizedExpected) {
    return expected;
  }
  
  // Layer 5: Unicode normalization (international support)
  const unicodeInput = normalizeUnicodeString(cleanInput);
  const unicodeExpected = normalizeUnicodeString(expected);
  if (unicodeInput === unicodeExpected) {
    return expected;
  }
  
  return null;
}

export function normalizeLiteralString(str: string): string {
  return str
    .replace(/[^\w\s-]/g, '') // Keep alphanumeric, whitespace, hyphens
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase();
}

function normalizeUnicodeString(str: string): string {
  return str
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks  
    .normalize('NFC') // Recompose
    .toLowerCase();
}

function looksLikeJson(str: string): boolean {
  const trimmed = str.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

export function isIncompleteQuotedString(str: string): boolean {
  const trimmed = str.trim();
  
  // Only consider it incomplete if it starts with a quote but doesn't have a matching closing quote
  // This handles streaming cases like '"pay' but allows cases like '"TWO" is the answer'
  
  if (trimmed.startsWith('"')) {
    // Look for the closing quote (not at the end, but anywhere)
    const closingQuoteIndex = trimmed.indexOf('"', 1);
    return closingQuoteIndex === -1; // Incomplete if no closing quote found
  }
  
  if (trimmed.startsWith("'")) {
    // Look for the closing quote (not at the end, but anywhere)
    const closingQuoteIndex = trimmed.indexOf("'", 1);
    return closingQuoteIndex === -1; // Incomplete if no closing quote found
  }
  
  return false;
}

function extractLiteralFromText(text: string, expectedValue: any): any | null {
  if (typeof expectedValue === 'string') {
    return extractStringLiteralFromText(text, expectedValue);
  }
  if (typeof expectedValue === 'number') {
    // Look for the exact number in text
    const numberRegex = new RegExp(`\\b${expectedValue}\\b`);
    if (numberRegex.test(text)) {
      return expectedValue;
    }
  }
  if (typeof expectedValue === 'boolean') {
    // Look for the exact boolean in text
    const boolRegex = new RegExp(`\\b${expectedValue}\\b`, 'i');
    if (boolRegex.test(text)) {
      return expectedValue;
    }
  }
  return null;
}

function extractStringLiteralFromText(text: string, expected: string): string | null {
  // Direct substring search with case coercion
  const regex = new RegExp(`\\b${expected}\\b`, 'i');
  const match = text.match(regex);
  if (match) {
    return expected; // Return expected case
  }
  
  // Quote-wrapped search
  const quotedRegex = new RegExp(`["']([^"']*${expected}[^"']*)["']`, 'i');
  const quotedMatch = text.match(quotedRegex);
  if (quotedMatch) {
    const extracted = quotedMatch[1].trim();
    if (matchStringLiteral(extracted, expected)) {
      return expected;
    }
  }
  
  return null;
}

// Ambiguity detection for literal unions (only for non-string literals)
export function detectLiteralAmbiguity(text: string, literalValues: any[]): boolean {
  if (literalValues.length <= 1) {
    return false;
  }
  
  // Only check non-string literals for ambiguity
  // String literals use first-match behavior
  const nonStringLiterals = literalValues.filter(val => typeof val !== 'string');
  
  if (nonStringLiterals.length <= 1) {
    return false;
  }
  
  const foundLiterals = [];
  
  for (const literalValue of nonStringLiterals) {
    let found = false;
    
    if (typeof literalValue === 'number') {
      const numberRegex = new RegExp(`\\b${literalValue}\\b`);
      found = numberRegex.test(text);
    } else if (typeof literalValue === 'boolean') {
      const boolRegex = new RegExp(`\\b${literalValue}\\b`, 'i');
      found = boolRegex.test(text);
    }
    
    if (found) {
      foundLiterals.push(literalValue);
    }
  }
  
  return foundLiterals.length > 1;
}

