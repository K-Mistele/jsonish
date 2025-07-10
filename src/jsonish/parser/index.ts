// Main parsing entry point - mirrors the exports from Rust parser/mod.rs
export { ParsingMode, nextFromMode, parse, type ParseOptions } from './entry'

// Additional parsing utilities for backward compatibility
export { defaultParseOptions, parseFunc, parseJsonish, parsePartial } from './entry'

import { z } from 'zod'
import type { Value } from '../../value'
// Import dependencies for createParser
import { type ParseOptions, defaultParseOptions, parse } from './entry'

// Legacy parser interface for backward compatibility with tests
export interface JsonishParser {
    parse<T>(input: string, schema: z.ZodSchema<T>, options?: Partial<ParseOptions>): T
}

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
            const result = parse(input, finalOptions, true)

            // Schema-aware coercion (matches target.coerce() in Rust)
            const extractedValue = coerceValueToSchema(result, schema)

            // Validate against schema and return
            return schema.parse(extractedValue) as T
        }
    }
}

/**
 * Schema-aware coercion - matches the Rust TypeCoercer::coerce logic
 */
function coerceValueToSchema<T>(value: Value, schema: z.ZodSchema<T>): unknown {
    // Handle AnyOf values - find best match for schema (matches Rust field_type.rs logic)
    if (value.type === 'any_of') {
        const { choices, originalString } = value
        const schemaType = getSchemaType(schema)

        // String/Enum/Literal priority - return original string if schema expects string-like
        if (schemaType === 'string' || schemaType === 'enum' || schemaType === 'literal') {
            return coercePrimitiveToSchema(originalString, schema)
        }

        // Try each choice to find best match
        for (const choice of choices) {
            try {
                const extracted = coerceValueToSchema(choice, schema)
                const validation = schema.safeParse(extracted)
                if (validation.success) {
                    return extracted
                }
            } catch (e) {
                // Continue to next choice
            }
        }

        // Fallback to original string
        return coercePrimitiveToSchema(originalString, schema)
    }

    // Handle Markdown wrapper (matches Rust logic)
    if (value.type === 'markdown') {
        return coerceValueToSchema(value.value, schema)
    }

    // Handle FixedJson wrapper (matches Rust logic)
    if (value.type === 'fixed_json') {
        return coerceValueToSchema(value.value, schema)
    }

    // Route to appropriate coercion based on schema type
    switch (getSchemaType(schema)) {
        case 'string':
            return coerceToString(value, schema)
        case 'number':
            return coerceToNumber(value, schema)
        case 'boolean':
            return coerceToBoolean(value, schema)
        case 'array':
            return coerceToArray(value, schema)
        case 'object':
            return coerceToObject(value, schema)
        case 'null':
            return null
        default:
            return convertValueToPlain(value)
    }
}

/**
 * Convert Value to plain JavaScript value without schema coercion
 */
function convertValueToPlain(value: Value): any {
    switch (value.type) {
        case 'string':
            return value.value
        case 'number':
            return value.value
        case 'boolean':
            return value.value
        case 'null':
            return null
        case 'array':
            return value.value.map((item: Value) => convertValueToPlain(item))
        case 'object':
            const obj: Record<string, any> = {}
            for (const [key, val] of value.value) {
                obj[key] = convertValueToPlain(val)
            }
            return obj
        case 'fixed_json':
            return convertValueToPlain(value.value)
        case 'markdown':
            return convertValueToPlain(value.value)
        case 'any_of':
            // Return first choice's plain value
            return value.choices.length > 0 ? convertValueToPlain(value.choices[0]) : value.originalString
        default:
            return value
    }
}

/**
 * Coerce to string - matches Rust coerce_string logic
 */
function coerceToString(value: Value, schema: z.ZodSchema<any>): string {
    switch (value.type) {
        case 'string':
            return value.value
        case 'null':
            throw new Error('Cannot coerce null to string')
        default:
            // Convert any other value to string (matches Rust JsonToString flag)
            return convertValueToPlain(value).toString()
    }
}

/**
 * Coerce to number - matches Rust coerce_int/coerce_float logic
 */
function coerceToNumber(value: Value, schema: z.ZodSchema<any>): number {
    switch (value.type) {
        case 'number':
            return value.value
        case 'string':
            return coerceStringToNumber(value.value)
        case 'array':
            // Try to coerce array to singular (matches Rust coerce_array_to_singular)
            if (value.value.length === 1) {
                return coerceToNumber(value.value[0], schema)
            }
            throw new Error('Cannot coerce array to number')
        default:
            throw new Error(`Cannot coerce ${value.type} to number`)
    }
}

/**
 * Coerce to boolean - matches Rust coerce_bool logic
 */
function coerceToBoolean(value: Value, schema: z.ZodSchema<any>): boolean {
    switch (value.type) {
        case 'boolean':
            return value.value
        case 'string':
            return coerceStringToBoolean(value.value)
        case 'array':
            // Try to coerce array to singular
            if (value.value.length === 1) {
                return coerceToBoolean(value.value[0], schema)
            }
            throw new Error('Cannot coerce array to boolean')
        default:
            throw new Error(`Cannot coerce ${value.type} to boolean`)
    }
}

/**
 * Coerce to array - matches Rust coerce_array logic
 */
function coerceToArray(value: Value, schema: z.ZodSchema<any>): any[] {
    // Get element schema for array items
    const elementSchema = schema instanceof z.ZodArray ? schema.element : schema

    switch (value.type) {
        case 'array':
            return value.value.map((item: Value) => coerceValueToSchema(item, elementSchema))
        default:
            // Single value to array - coerce the single value to the element type
            return [coerceValueToSchema(value, elementSchema)]
    }
}

/**
 * Coerce to object - matches Rust coerce_class logic
 */
function coerceToObject(value: Value, schema: z.ZodSchema<any>): Record<string, any> {
    switch (value.type) {
        case 'object':
            const obj: Record<string, any> = {}
            for (const [key, val] of value.value) {
                obj[key] = convertValueToPlain(val)
            }
            return obj
        default:
            throw new Error(`Cannot coerce ${value.type} to object`)
    }
}

/**
 * String to number coercion - matches Rust logic with comma/currency handling
 */
function coerceStringToNumber(str: string): number {
    const s = str.trim().replace(/,$/, '') // Remove trailing comma

    // Handle trailing dots (matches Rust logic)
    const withoutTrailingDot = s.replace(/\.$/, '')

    // Handle comma-separated numbers and currency (matches Rust float_from_comma_separated)
    const cleaned = withoutTrailingDot.replace(/[$,]/g, '')
    const num = Number(cleaned)

    if (!Number.isNaN(num)) {
        return num
    }

    // Handle fractions (matches Rust float_from_maybe_fraction)
    if (s.includes('/')) {
        const parts = s.split('/')
        if (parts.length === 2) {
            const numerator = Number(parts[0].trim())
            const denominator = Number(parts[1].trim())
            if (!Number.isNaN(numerator) && !Number.isNaN(denominator) && denominator !== 0) {
                return numerator / denominator
            }
        }
    }

    // Try to extract number from text (matches Rust float_from_comma_separated regex)
    const numberMatch = s.match(/[-+]?\$?(?:\d+(?:,\d+)*(?:\.\d+)?|\d+\.\d+|\d+|\.\d+)(?:e[-+]?\d+)?/)
    if (numberMatch) {
        const numberStr = numberMatch[0]
        const withoutCurrency = numberStr.replace(/^\$/, '')
        const withoutCommas = withoutCurrency.replace(/,/g, '')
        const extracted = Number(withoutCommas)
        if (!Number.isNaN(extracted)) {
            return extracted
        }
    }

    throw new Error(`Cannot parse "${str}" as number`)
}

/**
 * String to boolean coercion - matches Rust coerce_bool logic
 */
function coerceStringToBoolean(str: string): boolean {
    const lower = str.toLowerCase().trim()

    // Direct matches
    if (lower === 'true') return true
    if (lower === 'false') return false

    // Pattern matching (matches Rust match_string logic)
    // Check if both true and false appear - this is ambiguous
    const hasTruePattern = /\btrue\b/i.test(str)
    const hasFalsePattern = /\bfalse\b/i.test(str)

    if (hasTruePattern && hasFalsePattern) {
        throw new Error(`Ambiguous boolean value: "${str}" contains both true and false`)
    }

    if (hasTruePattern) return true
    if (hasFalsePattern) return false

    throw new Error(`Cannot parse "${str}" as boolean`)
}

/**
 * Primitive value coercion for strings
 */
function coercePrimitiveToSchema(str: string, schema: z.ZodSchema<any>): any {
    const schemaType = getSchemaType(schema)

    switch (schemaType) {
        case 'string':
            return str
        case 'number':
            return coerceStringToNumber(str)
        case 'boolean':
            return coerceStringToBoolean(str)
        default:
            return str
    }
}

/**
 * Get schema type - matches Rust TypeIR pattern matching
 */
function getSchemaType(schema: z.ZodSchema<any>): string {
    if (schema instanceof z.ZodString) return 'string'
    if (schema instanceof z.ZodNumber) return 'number'
    if (schema instanceof z.ZodBoolean) return 'boolean'
    if (schema instanceof z.ZodArray) return 'array'
    if (schema instanceof z.ZodObject) return 'object'
    if (schema instanceof z.ZodNull) return 'null'
    if (schema instanceof z.ZodEnum) return 'enum'
    if (schema instanceof z.ZodLiteral) return 'literal'
    if (schema instanceof z.ZodNullable) return getSchemaType(schema.unwrap())
    if (schema instanceof z.ZodOptional) return getSchemaType(schema.unwrap())
    return 'unknown'
}

// Markdown parser utilities for advanced usage
export { createCodeBlock, createString, isCodeBlock, isString } from './markdown-parser'
export type { MarkdownResult } from './markdown-parser'

// Value utilities - re-exported for convenience
export { CompletionState, Fixes, ValueUtils } from '../../value'
export type { Value } from '../../value'
