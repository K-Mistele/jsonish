import { IterativeParser } from './iterative-parser'
import type { ParseOptions } from './parser'
import { CompletionState, Fixes, type Value, ValueUtils } from './value'

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
        if (options.depth > 100) {
            throw new Error('Depth limit reached. Likely a circular reference.')
        }

        // Strategy 1: Try standard JSON parsing first
        try {
            const parsed = JSON.parse(input)
            const value = this.fromJSONValue(parsed)
            console.log(`[DEBUG] Standard JSON parse successful:`, value)
            return { type: 'any_of', choices: [value], originalString: input }
        } catch (e) {
            console.log(`[DEBUG] Standard JSON parse failed:`, e instanceof Error ? e.message : e)
        }

        // Strategy 2: Try iterative parser for unquoted keys/malformed JSON (high priority)
        if (options.allowMalformed && this.hasUnquotedKeysOrValues(input)) {
            try {
                console.log(`[DEBUG] Detected unquoted keys/values, trying iterative parser`)
                const iterativeParser = new IterativeParser()
                const iterativeResult = iterativeParser.parse(input)

                // If we got something meaningful, use it
                if (
                    iterativeResult.type !== 'string' ||
                    (iterativeResult.value.trim() !== '' && iterativeResult.value.trim() !== input.trim())
                ) {
                    console.log(`[DEBUG] Iterative parser successful:`, iterativeResult)
                    return {
                        type: 'any_of',
                        choices: [iterativeResult],
                        originalString: input
                    }
                }
            } catch (e) {
                console.log(`[DEBUG] Iterative parser failed:`, e instanceof Error ? e.message : e)
            }
        }

        // Strategy 2: Try markdown JSON extraction
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

        // Strategy 3: Try finding all JSON objects
        if (options.allowMalformed) {
            try {
                const jsonObjects = this.findAllJSONObjects(input, options)
                if (jsonObjects.length > 0) {
                    console.log(`[DEBUG] JSON object extraction successful:`, jsonObjects.length, 'objects')
                    const fixedResults = jsonObjects.map((obj) => ({
                        type: 'fixed_json' as const,
                        value: obj,
                        fixes: [Fixes.GreppedForJSON]
                    }))
                    return this.handleMultipleResults(fixedResults, input)
                }
            } catch (e) {
                console.log(`[DEBUG] JSON object extraction failed:`, e instanceof Error ? e.message : e)
            }
        }

        // Strategy 4: (removed - iterative parser only runs for unquoted key detection)

        // Strategy 5: Try fixing malformed JSON (fallback)
        if (options.allowMalformed) {
            try {
                const fixedResults = this.tryFixMalformedJSON(input, options)
                if (fixedResults.length > 0) {
                    console.log(`[DEBUG] Malformed JSON fix successful:`, fixedResults.length, 'results')
                    return this.handleMultipleResults(fixedResults, input)
                }
            } catch (e) {
                console.log(`[DEBUG] Malformed JSON fix failed:`, e instanceof Error ? e.message : e)
            }
        }

        // Strategy 6: Return as string if allowed
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
                            allowMalformed: false
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

    private tryFixMalformedJSON(input: string, options: InternalParseOptions): Value[] {
        const fixes: Array<{ value: Value; fixes: Fixes[] }> = []

        // Try simple fixes for common malformed JSON issues
        const fixAttempts = [
            // Remove trailing commas
            input.replace(/,(\s*[}\]])/g, '$1'),
            // Add missing quotes around unquoted keys
            input.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":'),
            // Fix common boolean variations
            input.replace(/\b(true|false)\b/gi, (match) => match.toLowerCase()),
            // Try to fix incomplete JSON by adding closing braces/brackets
            this.tryCompleteJSON(input)
        ]

        for (const attempt of fixAttempts) {
            if (attempt !== input) {
                try {
                    const parsed = JSON.parse(attempt)
                    const value = this.fromJSONValue(parsed)
                    fixes.push({ value, fixes: [Fixes.GreppedForJSON] })
                    break // Use first successful fix
                } catch (e) {
                    // Continue to next fix attempt
                }
            }
        }

        return fixes.map((fix) => ({
            type: 'fixed_json' as const,
            value: fix.value,
            fixes: fix.fixes
        }))
    }

    private tryCompleteJSON(input: string): string {
        const trimmed = input.trim()
        let completed = trimmed

        // Count unclosed braces and brackets
        let braceCount = 0
        let bracketCount = 0

        for (const char of trimmed) {
            if (char === '{') braceCount++
            else if (char === '}') braceCount--
            else if (char === '[') bracketCount++
            else if (char === ']') bracketCount--
        }

        // Add missing closing characters
        while (braceCount > 0) {
            completed += '}'
            braceCount--
        }
        while (bracketCount > 0) {
            completed += ']'
            bracketCount--
        }

        return completed
    }

    private hasUnquotedKeysOrValues(input: string): boolean {
        // Quick check for unquoted keys/values in JSON-like input
        const trimmed = input.trim()

        // Don't treat simple strings as having unquoted keys (avoid false positives for enums)
        if (!trimmed.includes('{') && !trimmed.includes('[') && !trimmed.includes(':')) {
            return false
        }

        // Look for patterns like: key: value (unquoted key)
        // or { key: value } with unquoted keys
        return (
            /[{,]\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*:/.test(trimmed) || // unquoted keys
            /:\s*[a-zA-Z_$][a-zA-Z0-9_$\s]+[,}]/.test(trimmed) || // unquoted values
            /'\w+/.test(trimmed)
        ) // single quotes
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
            return {
                type: 'any_of',
                choices: results,
                originalString: originalInput
            }
        }

        // For multiple results, include individual items + array of all items
        const arrayResult: Value = {
            type: 'array',
            value: results,
            completionState: CompletionState.Complete
        }

        return {
            type: 'any_of',
            choices: [...results, arrayResult],
            originalString: originalInput
        }
    }
}
