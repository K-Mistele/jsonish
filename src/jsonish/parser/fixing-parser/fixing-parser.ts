import { CompletionState, Fixes, type Value } from '../../value'
import type { ParseOptions } from '../entry'
import { JsonParseState } from './json-parse-state'

/**
 * Main fixing parser that handles malformed JSON using the state machine approach
 * Matches the Rust fixing_parser.rs implementation
 */
export function parse(str: string, _options: ParseOptions): Array<{ value: Value; fixes: Fixes[] }> {
    const state = new JsonParseState()

    // Process each character through the state machine
    const chars = Array.from(str)
    let i = 0

    while (i < chars.length) {
        const char = chars[i]
        const remaining = chars.slice(i + 1)

        // Convert remaining chars to iterable of [index, char] tuples
        const remainingIterable = remaining.map((c, idx) => [idx, c] as [number, string])

        try {
            const skipCount = state.processToken(char, remainingIterable)
            i += 1 + skipCount
        } catch (error) {
            // If processing fails, continue to next character
            i += 1
        }
    }

    // Close any remaining open collections
    while (state.collectionStack.length > 0) {
        state.completeCollection(CompletionState.Incomplete)
    }

    // Process completed values similar to Rust implementation
    const completedValues = state.completedValues

    switch (completedValues.length) {
        case 0:
            throw new Error('No JSON objects found')
        case 1: {
            const item = completedValues[0]
            return [{ value: item.value, fixes: item.fixes }]
        }
        default: {
            // If all values are strings, return as array
            if (completedValues.every((item) => item.name === 'string')) {
                const stringArray: Value = {
                    type: 'array',
                    value: completedValues.map((item) => item.value),
                    completionState: CompletionState.Incomplete
                }
                return [{ value: stringArray, fixes: [Fixes.InferredArray] }]
            }

            // Filter for only objects and arrays
            const objectsAndArrays = completedValues.filter((item) => item.name === 'Object' || item.name === 'Array')

            switch (objectsAndArrays.length) {
                case 0:
                    throw new Error('No JSON objects found')
                default:
                    return objectsAndArrays.map((item) => ({ value: item.value, fixes: item.fixes }))
            }
        }
    }
}
