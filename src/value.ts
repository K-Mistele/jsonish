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
 * Simplify a value by unwrapping single-choice any_of values
 */
function simplify(value: Value, isDone: boolean): Value {
    // Debug logging for complex malformed JSON test
    if (value.type === 'any_of' && value.originalString?.includes('Something horrible has happened')) {
        console.log('DEBUG: simplify - input type:', value.type)
        console.log('DEBUG: simplify - choices:', value.choices.length)
        for (let i = 0; i < value.choices.length; i++) {
            console.log(`DEBUG: simplify - choice ${i} type:`, value.choices[i].type)
        }
    }

    // Handle arrays that might be wrapping a parsed result with original string
    if (value.type === 'array' && value.value.length === 2) {
        const [first, second] = value.value
        // Check if this is a wrapped result (parsed value + original string)
        if (second.type === 'string' && value.completionState === CompletionState.Complete) {
            // Convert to any_of to let schema-aware layer choose
            return {
                type: 'any_of',
                choices: [first],
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

/**
 * Utility functions for working with Values
 */
export const ValueUtils = {
    simplify(value: Value, isDone: boolean): Value {
        return simplify(value, isDone)
    },

    getCompletionState(value: Value): CompletionState {
        switch (value.type) {
            case 'string':
            case 'number':
                return value.completionState
            case 'boolean':
            case 'null':
                return CompletionState.Complete
            case 'array':
            case 'object':
                return value.completionState
            case 'fixed_json':
                return ValueUtils.getCompletionState(value.value)
            case 'markdown':
                return value.completionState
            case 'any_of':
                // If any choice is incomplete, the whole value is incomplete
                for (const choice of value.choices) {
                    if (ValueUtils.getCompletionState(choice) === CompletionState.Incomplete) {
                        return CompletionState.Incomplete
                    }
                }
                return CompletionState.Complete
        }
    },

    getTypeName(value: Value): string {
        switch (value.type) {
            case 'string':
                return 'String'
            case 'number':
                return 'Number'
            case 'boolean':
                return 'Boolean'
            case 'null':
                return 'Null'
            case 'object':
                return 'Object'
            case 'array':
                return 'Array'
            case 'fixed_json':
                return `FixedJson<${ValueUtils.getTypeName(value.value)}>`
            case 'markdown':
                return `Markdown<${value.tag}>`
            case 'any_of':
                return `AnyOf[${value.choices.map((c) => ValueUtils.getTypeName(c)).join(', ')}]`
        }
    }
}
