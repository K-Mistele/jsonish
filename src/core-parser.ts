import { IterativeParser } from './iterative-parser'
import type { ParseOptions } from './parser'
import { CompletionState, type Value, ValueUtils } from './value'

/**
 * Internal parse options with depth tracking
 */
interface InternalParseOptions extends ParseOptions {
    depth: number
}

/**
 * Core parser implementation following BAML's modular architecture
 */
export class CoreParser {
    /**
     * Main parsing entry point
     */
    parse(input: string, options: ParseOptions, isDone = true): Value {
        const internalOptions: InternalParseOptions = { ...options, depth: 0 }
        const result = this.parseInternal(input, internalOptions, isDone)
        return ValueUtils.simplify(result, isDone)
    }

    private parseInternal(input: string, options: InternalParseOptions, isDone: boolean): Value {
        console.log(`[DEBUG] Parsing with options:`, options)
        console.log(`[DEBUG] Input (first 100 chars):`, input.substring(0, 100))

        // Prevent infinite recursion
        if (options.depth > 10) {
            throw new Error('Max recursion depth reached')
        }

        // Strategy 1: Try standard JSON parsing first (matches Rust exactly)
        try {
            const parsed = JSON.parse(input)
            const value = this.fromJSONValue(parsed)
            console.log(`[DEBUG] Standard JSON parse successful:`, value)
            return value // Return directly, not wrapped in any_of for standard JSON
        } catch (e) {
            console.log(`[DEBUG] Standard JSON parse failed:`, e instanceof Error ? e.message : e)
        }

        // Strategy 2: Try markdown JSON extraction (if enabled)
        if (options.extractFromMarkdown) {
            try {
                const markdownResults = this.parseMarkdownBlocks(input, options)
                if (markdownResults.length > 0) {
                    console.log(`[DEBUG] Markdown extraction successful:`, markdownResults.length, 'results')
                    return this.handleMultipleResults(markdownResults, input)
                }
            } catch (e) {
                console.log(`[DEBUG] Markdown extraction failed:`, e instanceof Error ? e.message : e)
            }
        }

        // Strategy 3: Try finding all JSON objects (if enabled)
        if (options.allowMalformed && options.allowFindingAllJsonObjects !== false) {
            try {
                const jsonObjects = this.findAllJSONObjects(input, options)
                if (jsonObjects.length > 0) {
                    console.log(`[DEBUG] JSON object extraction successful:`, jsonObjects.length, 'objects')
                    return this.handleMultipleResults(jsonObjects, input)
                }
            } catch (e) {
                console.log(`[DEBUG] JSON object extraction failed:`, e instanceof Error ? e.message : e)
            }
        }

        // Strategy 4: Try iterative parser (try_fix_jsonish equivalent) - the main malformed JSON handler
        if (options.allowMalformed) {
            try {
                console.log(`[DEBUG] Trying iterative parser for malformed JSON`)
                const iterativeParser = new IterativeParser()
                const iterativeResult = iterativeParser.parse(input)

                // Always wrap iterative parser result in array with original string (matches Rust)
                const arrayResult: Value = {
                    type: 'array',
                    value: [
                        iterativeResult,
                        {
                            type: 'string',
                            value: input,
                            completionState: CompletionState.Complete
                        }
                    ],
                    completionState: CompletionState.Complete
                }
                console.log(`[DEBUG] Iterative parser successful:`, iterativeResult)
                return arrayResult
            } catch (e) {
                console.log(`[DEBUG] Iterative parser failed:`, e instanceof Error ? e.message : e)
            }
        }

        // Strategy 5: Return as string if allowed (matches Rust allow_as_string)
        console.log(`[DEBUG] Falling back to string parsing`)
        return {
            type: 'string',
            value: input,
            completionState: isDone ? CompletionState.Complete : CompletionState.Incomplete
        }
    }

    private fromJSONValue(value: any): Value {
        if (value === null) {
            return { type: 'null' }
        }
        if (typeof value === 'string') {
            return {
                type: 'string',
                value,
                completionState: CompletionState.Complete
            }
        }
        if (typeof value === 'number') {
            return {
                type: 'number',
                value,
                completionState: CompletionState.Complete
            }
        }
        if (typeof value === 'boolean') {
            return { type: 'boolean', value }
        }
        if (Array.isArray(value)) {
            return {
                type: 'array',
                value: value.map((v) => this.fromJSONValue(v)),
                completionState: CompletionState.Complete
            }
        }
        if (typeof value === 'object') {
            const entries: Array<[string, Value]> = Object.entries(value).map(([k, v]) => [k, this.fromJSONValue(v)])
            return {
                type: 'object',
                value: entries,
                completionState: CompletionState.Complete
            }
        }
        throw new Error(`Unsupported JSON value type: ${typeof value}`)
    }

    private parseMarkdownBlocks(input: string, options: InternalParseOptions): Value[] {
        const results: Value[] = []

        // Find markdown JSON blocks using regex
        const markdownRegex = /```(\w+)?\s*\n([\s\S]*?)```/g
        let match: RegExpExecArray | null

        match = markdownRegex.exec(input)
        while (match !== null) {
            const [, lang, content] = match
            const trimmedContent = content.trim()

            if (trimmedContent) {
                try {
                    const nextOptions = {
                        ...options,
                        depth: options.depth + 1,
                        extractFromMarkdown: false
                    }
                    const parsed = this.parseInternal(trimmedContent, nextOptions, false)
                    results.push({
                        type: 'markdown',
                        tag: lang || 'unspecified',
                        value: parsed,
                        completionState: ValueUtils.getCompletionState(parsed)
                    })
                } catch (e) {
                    console.log(`[DEBUG] Failed to parse markdown block:`, e)
                }
            }
            match = markdownRegex.exec(input)
        }

        return results
    }

    private findAllJSONObjects(input: string, options: InternalParseOptions): Value[] {
        const results: Value[] = []
        const stack: string[] = []
        let jsonStartIndex: number | null = null

        for (let i = 0; i < input.length; i++) {
            const char = input[i]

            if (char === '{' || char === '[') {
                if (stack.length === 0) {
                    jsonStartIndex = i
                }
                stack.push(char)
            } else if (char === '}' || char === ']') {
                if (stack.length > 0) {
                    const expected = char === '}' ? '{' : '['
                    const last = stack[stack.length - 1]
                    if (last === expected) {
                        stack.pop()
                    }
                }

                if (stack.length === 0 && jsonStartIndex !== null) {
                    const jsonStr = input.substring(jsonStartIndex, i + 1)
                    try {
                        const nextOptions = {
                            ...options,
                            depth: options.depth + 1,
                            extractFromMarkdown: false, // Disable markdown extraction
                            allowFindingAllJsonObjects: false // Prevent recursive findAllJSONObjects
                        }
                        const parsed = this.parseInternal(jsonStr, nextOptions, false)
                        results.push(parsed)
                    } catch (e) {
                        console.log(`[DEBUG] Failed to parse extracted JSON:`, e)
                    }
                }
            }
        }

        return results
    }

    private handleMultipleResults(results: Value[], originalInput: string): Value {
        if (results.length === 0) {
            return {
                type: 'string',
                value: originalInput,
                completionState: CompletionState.Incomplete
            }
        }

        if (results.length === 1) {
            const singleResult = results[0]

            // If the single result is an array or object that represents the entire input,
            // return it directly without wrapping
            const trimmedInput = originalInput.trim()
            if (singleResult.type === 'array' && trimmedInput.startsWith('[') && trimmedInput.endsWith(']')) {
                return singleResult
            }
            if (singleResult.type === 'object' && trimmedInput.startsWith('{') && trimmedInput.endsWith('}')) {
                return singleResult
            }

            // Otherwise, wrap with original string like Rust implementation
            return {
                type: 'array',
                value: [
                    singleResult,
                    {
                        type: 'string',
                        value: originalInput,
                        completionState: CompletionState.Complete
                    }
                ],
                completionState: CompletionState.Complete
            }
        }

        // For multiple results, return array of results (matches Rust)
        return {
            type: 'array',
            value: results,
            completionState: CompletionState.Incomplete
        }
    }
}
