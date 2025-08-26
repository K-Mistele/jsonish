import { z } from 'zod';
import { Value, createStringValue, createNumberValue, createBooleanValue } from './value.js';

export function coerceToString(value: Value, schema: z.ZodString): string {
  switch (value.type) {
    case 'string':
      return value.value;
    case 'number':
      return value.value.toString();
    case 'boolean':
      return value.value.toString();
    case 'null':
      return 'null';
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
  
  return null;
}

export function isSchemaType<T extends z.ZodType>(schema: z.ZodType, type: new (...args: any[]) => T): schema is T {
  return schema instanceof type;
}