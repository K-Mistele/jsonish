/**
 * Completion state for tracking streaming/partial parsing
 */
export enum CompletionState {
    Complete = 'complete',
    Incomplete = 'incomplete'
}

/**
 * Fixes applied during parsing
 */
export enum Fixes {
    GreppedForJSON = 'grepped_for_json',
    InferredArray = 'inferred_array'
}

/**
 * Core Value type representing parsed JSON-like values with metadata
 * Based on BAML's Rust Value enum
 */
export type Value =
    // Primitive Types
    | { type: 'string'; value: string; completionState: CompletionState }
    | { type: 'number'; value: number; completionState: CompletionState }
    | { type: 'boolean'; value: boolean }
    | { type: 'null' }

    // Complex Types
    | {
          type: 'object'
          value: Array<[string, Value]>
          completionState: CompletionState
      }
    | { type: 'array'; value: Array<Value>; completionState: CompletionState }

    // Fixed types
    | {
          type: 'markdown'
          tag: string
          value: Value
          completionState: CompletionState
      }
    | { type: 'fixed_json'; value: Value; fixes: Fixes[] }
    | { type: 'any_of'; choices: Value[]; originalString: string }

/**
 * Utility functions for working with Values
 */
export namespace ValueUtils {
    export function getCompletionState(value: Value): CompletionState {
        switch (value.type) {
            case 'string':
            case 'number':
            case 'object':
            case 'array':
                return value.completionState
            case 'boolean':
            case 'null':
                return CompletionState.Complete
            case 'markdown':
                return value.completionState
            case 'fixed_json':
                return CompletionState.Complete
            case 'any_of':
                return value.choices.some((c) => getCompletionState(c) === CompletionState.Incomplete)
                    ? CompletionState.Incomplete
                    : CompletionState.Complete
        }
    }

    export function completeDeep(value: Value): void {
        switch (value.type) {
            case 'string':
            case 'number':
                value.completionState = CompletionState.Complete
                break
            case 'object':
                value.completionState = CompletionState.Complete
                for (const [_, v] of value.value) {
                    completeDeep(v)
                }
                break
            case 'array':
                value.completionState = CompletionState.Complete
                for (const v of value.value) {
                    completeDeep(v)
                }
                break
            case 'markdown':
                value.completionState = CompletionState.Complete
                completeDeep(value.value)
                break
            case 'fixed_json':
                completeDeep(value.value)
                break
            case 'any_of':
                for (const c of value.choices) {
                    completeDeep(c)
                }
                break
        }
    }

    export function getTypeName(value: Value): string {
        switch (value.type) {
            case 'string':
                return 'String'
            case 'number':
                return 'Number'
            case 'boolean':
                return 'Boolean'
            case 'null':
                return 'Null'
            case 'object': {
                const fields = value.value.map(([k, v]) => `${k}: ${getTypeName(v)}`).join(', ')
                return `Object{${fields}}`
            }
            case 'array': {
                const types = [...new Set(value.value.map((v) => getTypeName(v)))]
                return `Array[${types.join(' | ')}]`
            }
            case 'markdown':
                return `Markdown:${value.tag} - ${getTypeName(value.value)}`
            case 'fixed_json':
                return `${getTypeName(value.value)} (${value.fixes.length} fixes)`
            case 'any_of':
                return `AnyOf[${value.choices.map((c) => getTypeName(c)).join(', ')}]`
        }
    }

    export function simplify(value: Value, isDone: boolean): Value {
        // Handle arrays that might be wrapping a parsed result with original string
        if (value.type === 'array' && value.value.length === 2) {
            const [first, second] = value.value
            // Check if this is a wrapped result (parsed value + original string)
            if (
                second.type === 'string' &&
                first.type !== 'string' &&
                value.completionState === CompletionState.Complete
            ) {
                // Convert to any_of to let schema-aware layer choose
                return {
                    type: 'any_of',
                    choices: [first, second],
                    originalString: second.value
                }
            }
        }

        if (value.type === 'any_of') {
            const { choices, originalString } = value
            const simplifiedChoices = choices.map((c) => simplify(c, isDone))

            if (simplifiedChoices.length === 0) {
                return {
                    type: 'string',
                    value: originalString,
                    completionState: isDone ? CompletionState.Complete : CompletionState.Incomplete
                }
            }

            if (simplifiedChoices.length === 1) {
                const choice = simplifiedChoices[0]

                // If the single choice is a string that matches the original, return simple string
                if (choice.type === 'string' && choice.value === originalString) {
                    return {
                        type: 'string',
                        value: originalString,
                        completionState: isDone ? CompletionState.Complete : CompletionState.Incomplete
                    }
                }

                // Otherwise, preserve the any_of structure for schema-aware parsing
                // This allows the schema-aware layer to choose between the parsed result and original string
                return { type: 'any_of', choices: simplifiedChoices, originalString }
            }

            return { type: 'any_of', choices: simplifiedChoices, originalString }
        }

        return value
    }
}
