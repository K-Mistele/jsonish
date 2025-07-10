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
        // Prevent infinite recursion
        if (options.depth > 10) {
            throw new Error('Max recursion depth reached')
        }

        // Collect all possible results from different strategies
        const allResults: Value[] = []

        // Strategy 1: Try standard JSON parsing first (matches Rust exactly)
        try {
            const parsed = JSON.parse(input)
            const value = this.fromJSONValue(parsed)
            // For valid JSON, return immediately without trying other strategies
            return value
        } catch (e: any) {}

        // Strategy 2: Try markdown JSON extraction (if enabled)
        if (options.extractFromMarkdown) {
            try {
                const markdownResults = this.parseMarkdownBlocks(input, options)
                if (markdownResults.length > 0) {
                    allResults.push(...markdownResults)
                }
            } catch (e: any) {}
        }

        // Strategy 3: Try finding all JSON objects (if enabled)
        if (options.allowMalformed && options.allowFindingAllJsonObjects !== false) {
            try {
                const jsonObjects = this.findAllJSONObjects(input, options)
                if (jsonObjects.length > 0) {
                    allResults.push(...jsonObjects)
                }
            } catch (e: any) {}
        }

        // If we have results from strategies 2 or 3, return them
        if (allResults.length > 0) {
            return this.handleMultipleResults(allResults, input)
        }

        // Strategy 4: Try iterative parser (try_fix_jsonish equivalent) - the main malformed JSON handler
        if (options.allowMalformed) {
            try {
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
                return arrayResult
            } catch (e: any) {}
        }

        // Strategy 5: Return as string if allowed (matches Rust allow_as_string)
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
                } catch (e: any) {}
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
                        // First try standard JSON parsing
                        const parsed = JSON.parse(jsonStr)
                        const value = this.fromJSONValue(parsed)
                        results.push(value)
                    } catch (e: any) {
                        // If standard JSON fails, try iterative parser which handles malformed JSON
                        try {
                            const iterativeParser = new IterativeParser()
                            const parsed = iterativeParser.parse(jsonStr)
                            results.push(parsed)
                        } catch (e2: any) {
                            // If even iterative parser fails, skip this potential JSON object
                        }
                    }
                    jsonStartIndex = null
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

            // For single result, wrap with original string like Rust implementation
            return {
                type: 'array',
                value: [
                    results[0],
                    {
                        type: 'string',
                        value: originalInput,
                        completionState: CompletionState.Complete
                    }
                ],
                completionState: CompletionState.Complete
            }
        }

        // For multiple results, include all of them plus the array of all results
        // This matches the Rust behavior where schema-aware layer can choose
        const allResultsArray: Value = {
            type: 'array',
            value: results,
            completionState: CompletionState.Incomplete
        }

        return {
            type: 'array',
            value: [...results, allResultsArray],
            completionState: CompletionState.Incomplete
        }
    }
}
