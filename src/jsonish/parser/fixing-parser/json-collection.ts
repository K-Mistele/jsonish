import { CompletionState, type Value } from '../../value'

/**
 * Represents different types of JSON collections being parsed
 * Mirrors the Rust JsonCollection enum from BAML's jsonish parser
 */
export type JsonCollection =
    | { type: 'object'; keys: string[]; values: Value[]; completionState: CompletionState }
    | { type: 'array'; values: Value[]; completionState: CompletionState }
    | { type: 'quotedString'; content: string; completionState: CompletionState }
    | { type: 'tripleQuotedString'; content: string; completionState: CompletionState }
    | { type: 'singleQuotedString'; content: string; completionState: CompletionState }
    | {
          type: 'tripleBacktickString'
          lang?: { value: string; completionState: CompletionState }
          path?: { value: string; completionState: CompletionState }
          content: { value: string; completionState: CompletionState }
      }
    | { type: 'backtickString'; content: string; completionState: CompletionState }
    | { type: 'unquotedString'; content: string; completionState: CompletionState }
    | { type: 'trailingComment'; content: string; completionState: CompletionState }
    | { type: 'blockComment'; content: string; completionState: CompletionState }

/**
 * Get the name identifier for a JsonCollection
 */
export function getCollectionName(collection: JsonCollection): string {
    switch (collection.type) {
        case 'object':
            return 'Object'
        case 'array':
            return 'Array'
        case 'quotedString':
        case 'singleQuotedString':
        case 'tripleQuotedString':
        case 'tripleBacktickString':
        case 'backtickString':
            return 'String'
        case 'unquotedString':
            return 'UnquotedString'
        case 'trailingComment':
        case 'blockComment':
            return 'Comment'
        default:
            return 'Unknown'
    }
}

/**
 * Get the completion state for a JsonCollection
 */
export function getCompletionState(collection: JsonCollection): CompletionState {
    switch (collection.type) {
        case 'object':
        case 'array':
        case 'quotedString':
        case 'tripleQuotedString':
        case 'singleQuotedString':
        case 'backtickString':
        case 'unquotedString':
        case 'trailingComment':
        case 'blockComment':
            return collection.completionState
        case 'tripleBacktickString':
            return collection.content.completionState
        default:
            return CompletionState.Incomplete
    }
}

/**
 * Remove common leading whitespace from all lines (dedent)
 * Similar to Python's textwrap.dedent or Rust's dedent function
 */
function dedentString(text: string): string {
    const lines = text.split('\n')

    // Find the minimum indentation (ignoring empty lines)
    let minIndent = Number.POSITIVE_INFINITY
    for (const line of lines) {
        if (line.trim() === '') continue // Skip empty lines

        const indent = line.length - line.trimStart().length
        minIndent = Math.min(minIndent, indent)
    }

    // If no indentation found, return as-is
    if (minIndent === Number.POSITIVE_INFINITY || minIndent === 0) {
        return text
    }

    // Remove the common indentation from all lines
    return lines
        .map((line) => {
            if (line.trim() === '') return line // Keep empty lines as-is
            return line.slice(minIndent)
        })
        .join('\n')
}

/**
 * Convert a JsonCollection to a Value (or null for comments)
 * Mirrors the From<JsonCollection> for Option<Value> implementation in Rust
 */
export function collectionToValue(collection: JsonCollection, completionState: CompletionState): Value | null {
    switch (collection.type) {
        case 'trailingComment':
        case 'blockComment':
            // Comments are filtered out
            return null

        case 'object': {
            const entries: Array<[string, Value]> = []
            for (let i = 0; i < Math.min(collection.keys.length, collection.values.length); i++) {
                entries.push([collection.keys[i], collection.values[i]])
            }
            return {
                type: 'object',
                value: entries,
                completionState
            }
        }

        case 'array':
            return {
                type: 'array',
                value: collection.values,
                completionState
            }

        case 'quotedString':
        case 'singleQuotedString':
            return {
                type: 'string',
                value: collection.content,
                completionState
            }

        case 'tripleQuotedString':
            return {
                type: 'string',
                value: dedentString(collection.content),
                completionState
            }

        case 'tripleBacktickString': {
            // Split content at first newline to separate language/path info from actual content
            const firstNewlineIndex = collection.content.value.indexOf('\n')
            if (firstNewlineIndex === -1) {
                return {
                    type: 'string',
                    value: collection.content.value,
                    completionState: collection.content.completionState
                }
            }

            const codeblockContents = collection.content.value.slice(firstNewlineIndex + 1)
            return {
                type: 'string',
                value: dedentString(codeblockContents),
                completionState: collection.content.completionState
            }
        }

        case 'backtickString':
            return {
                type: 'string',
                value: collection.content,
                completionState
            }

        case 'unquotedString': {
            const trimmed = collection.content.trim()

            // Try parsing as primitives first
            if (trimmed === 'true') {
                return { type: 'boolean', value: true }
            }
            if (trimmed === 'false') {
                return { type: 'boolean', value: false }
            }
            if (trimmed === 'null') {
                return { type: 'null' }
            }

            // Try parsing as numbers
            const numberValue = Number(trimmed)
            if (!Number.isNaN(numberValue) && Number.isFinite(numberValue)) {
                return {
                    type: 'number',
                    value: numberValue,
                    completionState
                }
            }

            // Default to string
            return {
                type: 'string',
                value: trimmed,
                completionState
            }
        }

        default:
            return null
    }
}
