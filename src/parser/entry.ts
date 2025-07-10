import { CompletionState, Fixes, type Value } from '../value'
import { parseFixing } from './fixing-parser/index'
import type { MarkdownResult } from './markdown-parser'
import { parse as parseMarkdown } from './markdown-parser'
import { parse as parseMultiJson } from './multi-json-parser'

/**
 * Parsing options that control how the parser behaves
 * Mirrors the ParseOptions struct from Rust implementation
 */
export interface ParseOptions {
    /** Whether to find all JSON objects in the input */
    allFindingAllJsonObjects: boolean
    /** Whether to allow JSON extraction from markdown code blocks */
    allowMarkdownJson: boolean
    /** Whether to allow fixing malformed JSON */
    allowFixes: boolean
    /** Whether to allow parsing as a simple string if JSON parsing fails */
    allowAsString: boolean
    /** Maximum parsing depth to prevent infinite recursion */
    depth: number
}

/**
 * Default parsing options
 */
export const defaultParseOptions: ParseOptions = {
    allFindingAllJsonObjects: false,
    allowMarkdownJson: true,
    allowFixes: true,
    allowAsString: true,
    depth: 100
}

/**
 * Internal parsing function that handles the core parsing logic
 * Mirrors the parse_func from Rust implementation
 */
export function parseFunc(str: string, options: ParseOptions, isDone: boolean): Value {
    // Check depth limit to prevent infinite recursion
    if (options.depth > 100) {
        throw new Error('Depth limit reached. Likely a circular reference.')
    }

    // Try standard JSON parsing first
    try {
        const parsed = JSON.parse(str)
        // TODO: Convert parsed JSON to Value type with proper completion states
        return {
            type: 'any_of',
            choices: [convertJSONToValue(parsed)],
            originalString: str
        }
    } catch (error) {
        // JSON parsing failed, try other strategies
    }

    if (options.allowMarkdownJson) {
        try {
            const results = parseMarkdown(str, options, parseFunc) as MarkdownResult[]

            if (results.length === 1 && results[0].type === 'codeBlock') {
                return {
                    type: 'markdown',
                    tag: results[0].tag,
                    value: results[0].value,
                    completionState: CompletionState.Incomplete
                }
            }

            if (results.length > 1) {
                // Multiple results, return as any_of
                const choices = results
                    .filter((r): r is { type: 'codeBlock'; tag: string; value: Value } => r.type === 'codeBlock')
                    .map((r) => ({
                        type: 'markdown' as const,
                        tag: r.tag,
                        value: r.value,
                        completionState: CompletionState.Incomplete
                    }))
                return {
                    type: 'any_of',
                    choices,
                    originalString: str
                }
            }
        } catch (error) {
            // Markdown parsing failed, continue to other strategies
        }
    }

    if (options.allFindingAllJsonObjects) {
        try {
            const results = parseMultiJson(str, options, parseFunc) as Value[]

            if (results.length === 1) {
                const first = results[0]
                // If the result is just a string that matches the original, skip it
                if (first.type === 'string' && first.value === str) {
                    // Continue to other strategies
                } else {
                    return {
                        type: 'any_of',
                        choices: [
                            {
                                type: 'fixed_json',
                                value: first,
                                fixes: [Fixes.GreppedForJSON]
                            }
                        ],
                        originalString: str
                    }
                }
            } else if (results.length > 1) {
                // Multiple results
                const itemsClone: Value = {
                    type: 'array',
                    value: results,
                    completionState: CompletionState.Incomplete
                }

                const fixedValues = results.map((v) => ({
                    type: 'fixed_json' as const,
                    value: v,
                    fixes: [Fixes.GreppedForJSON]
                }))

                const choices: Value[] = [...fixedValues, itemsClone]

                return {
                    type: 'any_of',
                    choices,
                    originalString: str
                }
            }
        } catch (error) {
            // Multi-JSON parsing failed, continue to other strategies
        }
    }

    if (options.allowFixes) {
        try {
            const results = parseFixing(str, options) as Array<{ value: Value; fixes: Fixes[] }>

            if (results.length === 1) {
                const { value, fixes } = results[0]
                // Drop the fix if the string is the same and no fixes were applied
                if (fixes.length === 0 && value.type === 'string' && value.value === str) {
                    // Continue to fallback
                } else {
                    return {
                        type: 'any_of',
                        choices: [
                            {
                                type: 'fixed_json',
                                value,
                                fixes
                            }
                        ],
                        originalString: str
                    }
                }
            } else if (results.length > 1) {
                // Multiple results
                const fixedValues = results.map(({ value, fixes }) => ({
                    type: 'fixed_json' as const,
                    value,
                    fixes
                }))

                const itemsClone: Value = {
                    type: 'array',
                    value: fixedValues.map(({ value }) => value),
                    completionState: CompletionState.Incomplete
                }

                const choices: Value[] = [...fixedValues, itemsClone]

                return {
                    type: 'any_of',
                    choices,
                    originalString: str
                }
            }
        } catch (error) {
            // Fixing parser failed, continue to fallback
        }
    }

    // Final fallback to string if allowed
    if (options.allowAsString) {
        return {
            type: 'string',
            value: str,
            completionState: isDone ? CompletionState.Complete : CompletionState.Incomplete
        }
    }

    throw new Error('Failed to parse JSON')
}

/**
 * Convert standard JSON to Value type
 */
function convertJSONToValue(json: any): Value {
    if (json === null) {
        return { type: 'null' }
    }

    if (typeof json === 'boolean') {
        return { type: 'boolean', value: json }
    }

    if (typeof json === 'number') {
        return { type: 'number', value: json, completionState: CompletionState.Complete }
    }

    if (typeof json === 'string') {
        return { type: 'string', value: json, completionState: CompletionState.Complete }
    }

    if (Array.isArray(json)) {
        return {
            type: 'array',
            value: json.map(convertJSONToValue),
            completionState: CompletionState.Complete
        }
    }

    if (typeof json === 'object') {
        return {
            type: 'object',
            value: Object.entries(json).map(([key, value]) => [key, convertJSONToValue(value)]),
            completionState: CompletionState.Complete
        }
    }

    // Fallback
    return { type: 'string', value: String(json), completionState: CompletionState.Complete }
}

/**
 * Main public API for parsing JSONish content
 * Mirrors the parse function from Rust implementation
 *
 * @param str - Input string to parse
 * @param options - Parsing options (optional, uses defaults if not provided)
 * @param isDone - Whether the input is complete (for streaming scenarios)
 * @returns Parsed Value
 */
export function parse(str: string, options: ParseOptions = defaultParseOptions, isDone = true): Value {
    try {
        return parseFunc(str, options, isDone)
    } catch (error) {
        // If parsing fails and allowAsString is true, return as string
        if (options.allowAsString) {
            return {
                type: 'string',
                value: str.trim(),
                completionState: isDone ? CompletionState.Complete : CompletionState.Incomplete
            }
        }

        // Re-throw the error if we can't fall back to string
        throw error
    }
}

/**
 * Convenience function for parsing with default options
 */
export function parseJsonish(str: string): Value {
    return parse(str, defaultParseOptions, true)
}

/**
 * Convenience function for parsing incomplete/streaming content
 */
export function parsePartial(str: string, options: Partial<ParseOptions> = {}): Value {
    const fullOptions = { ...defaultParseOptions, ...options }
    return parse(str, fullOptions, false)
}
