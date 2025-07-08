import { z } from 'zod';

/**
 * JSONish Parser Interface
 * 
 * A schema-aware JSON parser that can handle malformed JSON, extract JSON from text,
 * and coerce types based on the expected Zod schema.
 */
export interface JsonishParser {
  /**
   * Parse a string into a typed object based on the provided Zod schema
   * 
   * @param input - The input string to parse (may contain JSON, be malformed, or mixed content)
   * @param schema - The Zod schema defining the expected output structure
   * @param options - Optional parsing options
   * @returns Parsed and validated object matching the schema
   */
  parse<T>(input: string, schema: z.ZodSchema<T>, options?: ParseOptions): T;
}

/**
 * Parse options for controlling parser behavior
 */
export interface ParseOptions {
  /** Allow parsing of incomplete/partial JSON (for streaming) */
  allowPartial?: boolean;
  /** Extract JSON from markdown code blocks */
  extractFromMarkdown?: boolean;
  /** Allow malformed JSON with missing quotes, trailing commas, etc. */
  allowMalformed?: boolean;
  /** Attempt to coerce types when possible */
  coerceTypes?: boolean;
}

/**
 * Default parse options
 */
export const DEFAULT_PARSE_OPTIONS: ParseOptions = {
  allowPartial: false,
  extractFromMarkdown: true,
  allowMalformed: true,
  coerceTypes: true,
};

/**
 * Stubbed implementation of the JSONish parser
 * 
 * This implementation always returns an empty object cast to the expected type.
 * This is intentional for TDD - all tests should fail until the real implementation is created.
 */
export class StubbedJsonishParser implements JsonishParser {
  parse<T>(input: string, schema: z.ZodSchema<T>, options: ParseOptions = DEFAULT_PARSE_OPTIONS): T {
    // Stubbed implementation - always returns empty object
    // This ensures all tests fail initially (TDD approach)
    console.warn('Using stubbed parser - implement the real parser to make tests pass');
    return {} as T;
  }
}

/**
 * Create a new JSONish parser instance
 */
export function createParser(options: ParseOptions = DEFAULT_PARSE_OPTIONS): JsonishParser {
  return new StubbedJsonishParser();
}

/**
 * Convenience function for parsing with default options
 */
export function parse<T>(input: string, schema: z.ZodSchema<T>, options?: ParseOptions): T {
  const parser = createParser(options);
  return parser.parse(input, schema, options);
}