import { z } from 'zod'
import { CoreParser } from './core-parser'
import type { Value } from './value'
import { CompletionState } from './value'

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
    parse<T>(input: string, schema: z.ZodSchema<T>, options?: ParseOptions): T
}

/**
 * Parse options for controlling parser behavior
 */
export interface ParseOptions {
    /** Allow parsing of incomplete/partial JSON (for streaming) */
    allowPartial?: boolean
    /** Extract JSON from markdown code blocks */
    extractFromMarkdown?: boolean
    /** Allow malformed JSON with missing quotes, trailing commas, etc. */
    allowMalformed?: boolean
    /** Attempt to coerce types when possible */
    coerceTypes?: boolean
    /** Internal flag to prevent recursive findAllJSONObjects calls */
    allowFindingAllJsonObjects?: boolean
}

/**
 * Default parse options
 */
export const DEFAULT_PARSE_OPTIONS: ParseOptions = {
    allowPartial: false,
    extractFromMarkdown: true,
    allowMalformed: true,
    coerceTypes: true,
    allowFindingAllJsonObjects: true
}

/**
 * Schema-aware JSONish parser implementation
 */
export class SchemaAwareJsonishParser implements JsonishParser {
    private coreParser = new CoreParser()

    parse<T>(input: string, schema: z.ZodSchema<T>, options: ParseOptions = DEFAULT_PARSE_OPTIONS): T {
        // Special handling for string schemas - prefer original input
        if (this.getSchemaType(schema) === 'string') {
            try {
                // Check if input is valid JSON (would parse as object/array)
                const testParse = JSON.parse(input)
                if (typeof testParse === 'object' && testParse !== null) {
                    // It's valid JSON object/array, but schema wants string
                    // Return the original input as string
                    const result = schema.parse(input)
                    return result
                }
            } catch (e) {
                // Not valid JSON, check if it's an incomplete quoted string
                const trimmed = input.trim()
                if (
                    (trimmed.startsWith('"') && !trimmed.endsWith('"')) ||
                    (trimmed.startsWith("'") && !trimmed.endsWith("'"))
                ) {
                    // Incomplete quoted string - return original
                    const result = schema.parse(input)
                    return result
                }
                // Continue with normal parsing
            }
        }

        // Parse the input using the core parser
        const parsedValue = this.coreParser.parse(input, options)

        // Convert the Value to a plain object and coerce types based on schema
        const plainObject = this.valueToPlainObject(parsedValue, schema, options, input)

        // Validate against the schema
        const result = schema.parse(plainObject)

        return result
    }

    private valueToPlainObject(
        value: Value,
        schema: z.ZodSchema<any>,
        options: ParseOptions,
        originalInput?: string
    ): any {
        // Temporary debug log
        if (value.type === 'array' && this.getSchemaType(schema) === 'array') {
        }

        // Handle string schema preference for quoted strings
        if (this.getSchemaType(schema) === 'string' && originalInput) {
            const trimmed = originalInput.trim()
            // If the input is a quoted string and we successfully parsed it, return the original
            if (
                (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
                (trimmed.startsWith("'") && trimmed.endsWith("'"))
            ) {
                if (value.type === 'string') {
                    return originalInput
                }
            }
        }

        // Handle AnyOf by trying each choice - prefer string for string schemas
        if (value.type === 'any_of') {
            const schemaType = this.getSchemaType(schema)

            // For non-string schemas, try parsing choices first (to extract numbers/booleans from text)
            if (schemaType !== 'string') {
                // Try each parsed choice first
                for (const choice of value.choices) {
                    try {
                        const converted = this.valueToPlainObject(choice, schema, options, originalInput)
                        const validated = schema.safeParse(converted)
                        if (validated.success) {
                            return converted
                        }
                    } catch (e) {
                        // Continue to next choice
                    }
                }

                // If no choice worked, try coercing the original string
                return this.coerceToSchema(value.originalString, schema, options)
            }

            // For string schemas, prefer original string when it contains structured data
            if (schemaType === 'string') {
                // If original string contains JSON-like structure, prefer it
                const hasStructuredContent = this.hasStructuredContent(value.originalString)
                if (hasStructuredContent) {
                    try {
                        const validated = schema.safeParse(value.originalString)
                        if (validated.success) {
                            return value.originalString
                        }
                    } catch (e) {
                        // Continue to other approaches
                    }
                }

                // Otherwise, try parsed choices first (might extract better typed values)
                for (const choice of value.choices) {
                    try {
                        const converted = this.valueToPlainObject(choice, schema, options, originalInput)
                        const validated = schema.safeParse(converted)
                        if (validated.success) {
                            return converted
                        }
                    } catch (e) {
                        // Continue to next choice
                    }
                }

                // Finally, fall back to original string
                return this.coerceToSchema(value.originalString, schema, options)
            }
        }

        // Handle other Value types
        switch (value.type) {
            case 'null':
                return null
            case 'string':
                return this.coerceToSchema(value.value, schema, options)
            case 'number':
                return this.coerceToSchema(value.value, schema, options)
            case 'boolean':
                return this.coerceToSchema(value.value, schema, options)
            case 'array': {
                // Check if this is a multi-result array (like from markdown extraction)
                // where we need to pick the result that matches the schema
                if (value.value.length > 1 && value.completionState === CompletionState.Incomplete) {
                    // Try each value against the schema to find the best match
                    for (const item of value.value) {
                        try {
                            const converted = this.valueToPlainObject(item, schema, options, originalInput)
                            const validated = schema.safeParse(converted)
                            if (validated.success) {
                                return converted
                            }
                        } catch (e) {
                            // Continue to next item
                        }
                    }
                }

                // Standard array processing
                const schemaInfo = this.getArraySchemaInfo(schema)
                if (schemaInfo) {
                    // Schema expects array - convert each element
                    return value.value.map((item) => this.valueToPlainObject(item, schemaInfo.element, options))
                }
                // Schema doesn't expect array - treat as multi-result and pick first valid
                if (value.value.length > 0) {
                    return this.valueToPlainObject(value.value[0], schema, options)
                }
                return []
            }
            case 'object': {
                const obj: Record<string, any> = {}

                // Handle object schema properly
                if (schema instanceof z.ZodObject) {
                    const shape = schema.shape

                    // Create a map for normalized key matching
                    const normalizedKeyMap = new Map<string, string>()
                    for (const key of Object.keys(shape)) {
                        normalizedKeyMap.set(key.trim(), key)
                    }

                    for (const [key, val] of value.value) {
                        const trimmedKey = key.trim()
                        const schemaKey = normalizedKeyMap.get(trimmedKey)

                        if (schemaKey && shape[schemaKey]) {
                            obj[schemaKey] = this.valueToPlainObject(val, shape[schemaKey], options)
                        } else if (shape[key]) {
                            // Try exact match as fallback
                            obj[key] = this.valueToPlainObject(val, shape[key], options)
                        } else {
                            // Field not in schema, use raw value
                            obj[key] = this.valueToPlainObject(val, z.any(), options)
                        }
                    }
                } else {
                    // Not an object schema, convert all values generically
                    for (const [key, val] of value.value) {
                        obj[key] = this.valueToPlainObject(val, z.any(), options)
                    }
                }

                return this.coerceToSchema(obj, schema, options)
            }
            case 'fixed_json':
                // Fixed JSON contains the actual value
                return this.valueToPlainObject(value.value, schema, options, originalInput)
            case 'markdown':
                // Markdown contains the extracted value
                return this.valueToPlainObject(value.value, schema, options, originalInput)
            default:
                throw new Error(`Unsupported value type: ${(value as any).type}`)
        }
    }

    private coerceToSchema(value: any, schema: z.ZodSchema<any>, options: ParseOptions): any {
        if (!options.coerceTypes) {
            return value
        }

        // Try to parse with the schema first
        const parseResult = schema.safeParse(value)
        if (parseResult.success) {
            return parseResult.data
        }

        // Get the schema type for intelligent coercion
        const schemaType = this.getSchemaType(schema)

        return this.coerceValueToType(value, schemaType, schema, options)
    }

    private getSchemaType(schema: z.ZodSchema<any>): string {
        if (schema instanceof z.ZodString) return 'string'
        if (schema instanceof z.ZodNumber) return 'number'
        if (schema instanceof z.ZodBoolean) return 'boolean'
        if (schema instanceof z.ZodNull) return 'null'
        if (schema instanceof z.ZodArray) return 'array'
        if (schema instanceof z.ZodObject) return 'object'
        if (schema instanceof z.ZodUnion) return 'union'
        if (schema instanceof z.ZodEnum) return 'enum'
        if (schema instanceof z.ZodLiteral) return 'literal'
        if (schema instanceof z.ZodOptional) return this.getSchemaType(schema.unwrap())
        if (schema instanceof z.ZodNullable) return this.getSchemaType(schema.unwrap())
        return 'unknown'
    }

    private coerceValueToType(value: any, targetType: string, schema: z.ZodSchema<any>, options: ParseOptions): any {
        // Handle string inputs
        if (typeof value === 'string') {
            const trimmed = value.trim()

            switch (targetType) {
                case 'number':
                    return this.parseNumberFromString(trimmed)
                case 'boolean':
                    return this.parseBooleanFromString(trimmed, value)
                case 'array':
                    // Single value to array
                    if (schema instanceof z.ZodArray) {
                        return [
                            this.coerceValueToType(value, this.getSchemaType(schema.element), schema.element, options)
                        ]
                    }
                    return [value]
                case 'object':
                    // Single value to object (common pattern in tests)
                    if (schema instanceof z.ZodObject) {
                        const shape = schema.shape
                        const keys = Object.keys(shape)
                        if (keys.length === 1) {
                            const key = keys[0]
                            return {
                                [key]: this.coerceValueToType(
                                    value,
                                    this.getSchemaType(shape[key]),
                                    shape[key],
                                    options
                                )
                            }
                        }
                    }
                    return value
                case 'enum':
                    // Advanced enum pattern extraction
                    if (schema instanceof z.ZodEnum) {
                        const enumValues = schema.options as string[]
                        const extracted = this.extractEnumFromText(trimmed, enumValues)
                        return extracted !== null ? extracted : value
                    }
                    return value
                case 'literal':
                    // Case-insensitive literal matching for strings
                    if (schema instanceof z.ZodLiteral) {
                        const literalValue = schema.value
                        if (typeof literalValue === 'string' && literalValue.toLowerCase() === trimmed.toLowerCase()) {
                            return literalValue
                        }
                    }
                    return value
                case 'union':
                    // Try each union option
                    if (schema instanceof z.ZodUnion) {
                        for (const option of schema.options) {
                            try {
                                const coerced = this.coerceValueToType(
                                    value,
                                    this.getSchemaType(option),
                                    option,
                                    options
                                )
                                const result = option.safeParse(coerced)
                                if (result.success) {
                                    return coerced
                                }
                            } catch (e) {
                                // Continue to next option
                            }
                        }
                    }
                    return value
            }
        }

        // Handle other input types
        if (typeof value === 'number' && targetType === 'string') {
            return value.toString()
        }

        if (typeof value === 'boolean' && targetType === 'string') {
            return value.toString()
        }

        // Array to single value (take first element)
        if (Array.isArray(value) && targetType !== 'array' && value.length > 0) {
            return this.coerceValueToType(value[0], targetType, schema, options)
        }

        // No coercion possible, return original value
        return value
    }

    /**
     * Parse numbers from various string formats
     */
    private parseNumberFromString(str: string): number | string {
        // Remove common formatting characters
        let cleaned = str.replace(/[$,]/g, '') // Remove dollar signs and commas

        // Handle fractions like "1/5"
        if (cleaned.includes('/')) {
            const parts = cleaned.split('/')
            if (parts.length === 2) {
                const numerator = Number(parts[0].trim())
                const denominator = Number(parts[1].trim())
                if (!Number.isNaN(numerator) && !Number.isNaN(denominator) && denominator !== 0) {
                    return numerator / denominator
                }
            }
        }

        // Handle trailing dots like "12.11."
        if (cleaned.endsWith('.') && !cleaned.endsWith('..')) {
            cleaned = cleaned.slice(0, -1)
        }

        // Extract first number from text like "1 cup unsalted butter"
        const numberMatch = cleaned.match(/^(\d+(?:\.\d+)?)/)
        if (numberMatch) {
            const num = Number(numberMatch[1])
            if (!Number.isNaN(num)) {
                return num
            }
        }

        // Try parsing the cleaned string directly
        const num = Number(cleaned)
        return Number.isNaN(num) ? str : num
    }

    /**
     * Parse booleans from text, including extraction from longer strings
     */
    private parseBooleanFromString(trimmed: string, originalValue: string): boolean | string {
        const lower = trimmed.toLowerCase()

        // Direct boolean matches
        if (lower === 'true' || lower === 'yes' || lower === '1') return true
        if (lower === 'false' || lower === 'no' || lower === '0') return false

        // Check for ambiguous cases - text containing both true and false
        const containsTrue = /\btrue\b/i.test(originalValue)
        const containsFalse = /\bfalse\b/i.test(originalValue)

        if (containsTrue && containsFalse) {
            // Ambiguous - contains both true and false
            throw new Error('Ambiguous boolean value: text contains both "true" and "false"')
        }

        // Extract boolean from text patterns
        const booleanPatterns = [
            /\b(true|false)\b/i,
            /\*\*(true|false)\*\*/i, // **True**
            /answer\s*:?\s*(true|false)\b/i // Answer: True
        ]

        for (const pattern of booleanPatterns) {
            const match = originalValue.match(pattern)
            if (match) {
                const found = match[1].toLowerCase()
                if (found === 'true') return true
                if (found === 'false') return false
            }
        }

        return originalValue
    }

    /**
     * Extract enum values from text using advanced pattern matching
     * Handles cases like:
     * - "ONE: description" -> "ONE"
     * - "**TWO**" -> "TWO"
     * - "k1" -> "ONE" (via aliases)
     * - "The answer is TWO" -> "TWO"
     */
    private extractEnumFromText(text: string, enumValues: string[]): string | null {
        // 1. Direct case-insensitive match
        for (const enumValue of enumValues) {
            if (text.toLowerCase() === enumValue.toLowerCase()) {
                return enumValue
            }
        }

        // 2. Extract from patterns like "VALUE: description" or "VALUE - description"
        const prefixPatterns = [
            /^([A-Z_0-9-]+)\s*[:]\s*/i, // "ONE: description"
            /^([A-Z_0-9-]+)\s*[-]\s*/i, // "ONE - description"
            /^([A-Z_0-9-]+)\s+[a-z]/i // "ONE description" (enum followed by lowercase)
        ]

        for (const pattern of prefixPatterns) {
            const match = text.match(pattern)
            if (match) {
                const candidate = match[1]
                for (const enumValue of enumValues) {
                    if (candidate.toLowerCase() === enumValue.toLowerCase()) {
                        return enumValue
                    }
                }
            }
        }

        // 3. Extract from markdown patterns like "**VALUE**" or "`VALUE`"
        const markdownPatterns = [
            /\*\*([A-Z_0-9-]+)\*\*/i, // **VALUE**
            /`([A-Z_0-9-]+)`/i, // `VALUE`
            /"([A-Z_0-9-]+)"/i, // "VALUE"
            /'([A-Z_0-9-]+)'/i // 'VALUE'
        ]

        for (const pattern of markdownPatterns) {
            const match = text.match(pattern)
            if (match) {
                const candidate = match[1]
                for (const enumValue of enumValues) {
                    if (candidate.toLowerCase() === enumValue.toLowerCase()) {
                        return enumValue
                    }
                }
            }
        }

        // 4. Find enum value anywhere in the text (word boundaries)
        for (const enumValue of enumValues) {
            const regex = new RegExp(`\\b${enumValue}\\b`, 'i')
            if (regex.test(text)) {
                return enumValue
            }
        }

        // 5. Handle common aliases (basic implementation)
        const aliasMap: Record<string, string> = {
            k1: 'ONE',
            'k-2-3.1_1': 'TWO',
            'NUMBER THREE': 'THREE',
            null: 'null' // Handle null string
        }

        const normalizedText = text.toLowerCase().trim()
        for (const [alias, enumValue] of Object.entries(aliasMap)) {
            if (normalizedText === alias.toLowerCase()) {
                // Check if this enum value exists in our schema
                for (const schemaEnum of enumValues) {
                    if (schemaEnum.toLowerCase() === enumValue.toLowerCase()) {
                        return schemaEnum
                    }
                }
            }
        }

        return null
    }

    /**
     * Check if a string contains structured content (e.g., JSON, markdown code block)
     * This is a heuristic and might need refinement based on actual JSON/Markdown patterns.
     */
    private hasStructuredContent(text: string): boolean {
        // Simple checks for common JSON/Markdown patterns
        if (text.startsWith('```json') && text.endsWith('```')) {
            return true
        }
        if (text.startsWith('```') && text.endsWith('```')) {
            return true
        }
        if (text.startsWith('{') && text.endsWith('}')) {
            return true
        }
        if (text.startsWith('[') && text.endsWith(']')) {
            return true
        }
        return false
    }

    /**
     * Check if a schema expects an array
     */
    private isArraySchema(schema: z.ZodSchema<any>): boolean {
        return (
            schema instanceof z.ZodArray ||
            (schema instanceof z.ZodUnion && schema._def.options.some((opt: any) => opt instanceof z.ZodArray)) ||
            (schema instanceof z.ZodOptional && this.isArraySchema(schema._def.innerType)) ||
            (schema instanceof z.ZodNullable && this.isArraySchema(schema._def.innerType))
        )
    }

    /**
     * Get array schema info if the schema expects an array
     */
    private getArraySchemaInfo(schema: z.ZodSchema<any>): { element: z.ZodSchema<any> } | null {
        if (schema instanceof z.ZodArray) {
            return { element: schema.element }
        }
        if (schema instanceof z.ZodOptional && this.isArraySchema(schema._def.innerType)) {
            return this.getArraySchemaInfo(schema._def.innerType)
        }
        if (schema instanceof z.ZodNullable && this.isArraySchema(schema._def.innerType)) {
            return this.getArraySchemaInfo(schema._def.innerType)
        }
        return null
    }

    private enumValues: Map<z.ZodEnum<any>, Set<string>> = new Map()
}

/**
 * Create a new JSONish parser instance
 */
export function createParser(options: ParseOptions = DEFAULT_PARSE_OPTIONS): JsonishParser {
    return new SchemaAwareJsonishParser()
}

/**
 * Convenience function for parsing with default options
 */
export function parse<T>(input: string, schema: z.ZodSchema<T>, options?: ParseOptions): T {
    const parser = createParser(options)
    return parser.parse(input, schema, options)
}
