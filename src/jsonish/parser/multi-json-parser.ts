import type { Value } from '../../value'
import { CompletionState } from '../../value'
import type { ParseOptions } from './entry'
import { ParsingMode, nextFromMode } from './entry'

/**
 * Parse multiple JSON objects from a string
 * Mirrors the parse function from Rust multi_json_parser.rs
 *
 * @param str Input string that may contain multiple JSON objects
 * @param options Parsing options
 * @param parseFunc Function to parse individual JSON objects
 * @returns Array of parsed Values
 */
export function parse(
    str: string,
    options: ParseOptions,
    parseFunc: (content: string, options: ParseOptions, isDone: boolean) => Value
): Value[] {
    const jsonObjects: Value[] = []
    const stack: string[] = []
    let jsonStrStart: number | null = null

    for (let index = 0; index < str.length; index++) {
        const character = str[index]

        switch (character) {
            case '{':
            case '[':
                if (stack.length === 0) {
                    jsonStrStart = index
                }
                stack.push(character)
                break

            case '}':
            case ']':
                if (stack.length > 0) {
                    const expected = character === '}' ? '{' : '['
                    const last = stack[stack.length - 1]

                    if (last === expected) {
                        stack.pop()
                    } else {
                        throw new Error('Mismatched brackets')
                    }
                }

                if (stack.length === 0 && jsonStrStart !== null) {
                    const endIndex = index + 1
                    const jsonStr = str.slice(jsonStrStart, endIndex)

                    try {
                        // Use nextFromMode like the Rust implementation
                        const newOptions = nextFromMode(options, ParsingMode.AllJsonObjects)
                        const parsedValue = parseFunc(jsonStr, newOptions, false)
                        jsonObjects.push(parsedValue)
                    } catch (error) {
                        // Ignore errors and continue processing
                        console.error('Failed to parse JSON object:', error)
                    }
                }
                break
        }
    }

    // Handle incomplete JSON at the end
    if (stack.length > 0 && jsonStrStart !== null) {
        const jsonStr = str.slice(jsonStrStart)

        try {
            // Use nextFromMode like the Rust implementation
            const newOptions = nextFromMode(options, ParsingMode.AllJsonObjects)
            const parsedValue = parseFunc(jsonStr, newOptions, false)
            // Mark the last object as complete
            completeValueDeeply(parsedValue)
            jsonObjects.push(parsedValue)
        } catch (error) {
            // Ignore errors
            console.error('Failed to parse incomplete JSON object:', error)
        }
    }

    if (jsonObjects.length === 0) {
        throw new Error('No JSON objects found')
    }

    return jsonObjects
}

/**
 * Helper function to mark a value as complete deeply
 * Mirrors the complete_stack_head function from Rust
 */
function completeValueDeeply(value: Value): void {
    switch (value.type) {
        case 'string':
        case 'number':
            value.completionState = CompletionState.Complete
            break
        case 'object':
            value.completionState = CompletionState.Complete
            for (const [_, v] of value.value) {
                completeValueDeeply(v)
            }
            break
        case 'array':
            value.completionState = CompletionState.Complete
            for (const v of value.value) {
                completeValueDeeply(v)
            }
            break
        case 'markdown':
            value.completionState = CompletionState.Complete
            completeValueDeeply(value.value)
            break
        case 'fixed_json':
            completeValueDeeply(value.value)
            break
        case 'any_of':
            for (const v of value.choices) {
                completeValueDeeply(v)
            }
            break
        // Boolean and null are always complete
        case 'boolean':
        case 'null':
            break
    }
}
