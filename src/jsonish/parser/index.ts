// Parser module exports - mirrors Rust parser/mod.rs structure

// Main parsing exports
export { ParsingMode, nextFromMode, parse, type ParseOptions } from './entry'

// Additional parsing utilities
export { defaultParseOptions, parseFunc, parseJsonish, parsePartial } from './entry'

// Markdown parser utilities
export { createCodeBlock, createString, isCodeBlock, isString } from './markdown-parser'
export type { MarkdownResult } from './markdown-parser'

// Re-export Value types for convenience within parser module
export { CompletionState, Fixes, ValueUtils } from '../value'
export type { Value } from '../value'

// Import our deserializer for the createParser function
import { z } from 'zod'
import type { Value } from '../value'
import { type ParseOptions, defaultParseOptions, parse } from './entry'
import { deserialize, ParsingError } from '../../deserializer'

// Legacy parser interface for backward compatibility with tests
export interface JsonishParser {
    parse<T>(input: string, schema: z.ZodSchema<T>, options?: Partial<ParseOptions>): T
}

/**
 * Create a parser that combines JSON parsing with schema-based deserialization
 * This is the main API for parsing JSON-like strings into typed values
 */
export function createParser(options: ParseOptions = defaultParseOptions): JsonishParser {
    return {
        parse<T>(input: string, schema: z.ZodSchema<T>, parseOptions?: Partial<ParseOptions>): T {
            const finalOptions = { ...options, ...parseOptions }

            // CRITICAL: String schema priority check - matches Rust implementation
            // If schema expects a string, return the input string directly (from_str logic)
            if (schema instanceof z.ZodString) {
                return schema.parse(input) as T
            }

            // Parse using the raw parser (matches jsonish::parse() in Rust)
            const parsedValue = parse(input, finalOptions, true)

            // Use our deserializer to coerce the value to match the schema
            const deserializedResult = deserialize(parsedValue, schema)
            
            if (deserializedResult instanceof ParsingError) {
                throw new Error(deserializedResult.toString())
            }

            // The deserializer now returns the typed value directly
            return deserializedResult
        }
    }
}
