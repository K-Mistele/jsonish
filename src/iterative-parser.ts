import { CompletionState, type Value } from './value'

/**
 * Represents different types of JSON collections being parsed
 */
type JsonCollection =
    | { type: 'object'; keys: string[]; values: Value[]; completionState: CompletionState }
    | { type: 'array'; values: Value[]; completionState: CompletionState }
    | { type: 'quotedString'; content: string; completionState: CompletionState }
    | { type: 'singleQuotedString'; content: string; completionState: CompletionState }
    | { type: 'unquotedString'; content: string; completionState: CompletionState }
    | { type: 'trailingComment'; content: string; completionState: CompletionState }
    | { type: 'blockComment'; content: string; completionState: CompletionState }

enum CloseStringResult {
    Close = 0,
    Continue = 1
}

/**
 * Advanced iterative parser that handles complex malformed JSON scenarios
 * using a state machine approach similar to BAML's Rust implementation
 */
export class IterativeParser {
    private collectionStack: JsonCollection[] = []
    private completedValues: Array<{ name: string; value: Value }> = []

    /**
     * Parse malformed JSON using state machine approach
     */
    parse(input: string): Value {
        this.reset()

        const chars = Array.from(input)
        let i = 0

        while (i < chars.length) {
            const char = chars[i]
            const remaining = chars.slice(i + 1)

            const skipCount = this.processToken(char, remaining, i)
            i += 1 + skipCount
        }

        // Close any remaining open collections
        while (this.collectionStack.length > 0) {
            this.completeCollection(CompletionState.Incomplete)
        }

        return this.buildResult()
    }

    private reset(): void {
        this.collectionStack = []
        this.completedValues = []
    }

    private processToken(token: string, remaining: string[], position: number): number {
        const lastCollection = this.collectionStack[this.collectionStack.length - 1]

        if (!lastCollection) {
            return this.findStartingValue(token, remaining, position)
        }

        switch (lastCollection.type) {
            case 'object':
                return this.processObjectToken(token, remaining, position)
            case 'array':
                return this.processArrayToken(token, remaining, position)
            case 'quotedString':
                return this.processQuotedStringToken(token, remaining, position, '"')
            case 'singleQuotedString':
                return this.processQuotedStringToken(token, remaining, position, "'")
            case 'unquotedString':
                return this.processUnquotedStringToken(token, remaining, position)
            case 'trailingComment':
                return this.processTrailingCommentToken(token, remaining, position)
            case 'blockComment':
                return this.processBlockCommentToken(token, remaining, position)
            default:
                return 0
        }
    }

    private processObjectToken(token: string, remaining: string[], position: number): number {
        switch (token) {
            case '}':
                this.completeCollection(CompletionState.Complete)
                return 0
            case ',':
            case ':':
                return 0 // Skip these tokens
            default:
                return this.findStartingValue(token, remaining, position)
        }
    }

    private processArrayToken(token: string, remaining: string[], position: number): number {
        switch (token) {
            case ']':
                this.completeCollection(CompletionState.Complete)
                return 0
            case ',':
                return 0 // Skip comma
            default:
                return this.findStartingValue(token, remaining, position)
        }
    }

    private processQuotedStringToken(
        token: string,
        remaining: string[],
        position: number,
        closingChar: string
    ): number {
        if (token === closingChar) {
            if (this.shouldCloseString(remaining, position, closingChar)) {
                this.completeCollection(CompletionState.Complete)
                return 0
            }
        }

        this.consumeToken(token)
        return 0
    }

    private processUnquotedStringToken(token: string, remaining: string[], position: number): number {
        this.consumeToken(token)

        const closeResult = this.shouldCloseUnquotedString(remaining, position)
        if (closeResult.shouldClose) {
            this.completeCollection(closeResult.completionState)
            return closeResult.skipCount
        }

        return 0
    }

    private processTrailingCommentToken(token: string, remaining: string[], position: number): number {
        if (token === '\n') {
            this.completeCollection(CompletionState.Complete)
            return 0
        }

        this.consumeToken(token)
        return 0
    }

    private processBlockCommentToken(token: string, remaining: string[], position: number): number {
        if (token === '*' && remaining[0] === '/') {
            this.completeCollection(CompletionState.Complete)
            return 1 // Skip the '/' as well
        }

        this.consumeToken(token)
        return 0
    }

    private findStartingValue(token: string, remaining: string[], position: number): number {
        switch (token) {
            case '{':
                this.collectionStack.push({
                    type: 'object',
                    keys: [],
                    values: [],
                    completionState: CompletionState.Incomplete
                })
                return 0
            case '[':
                this.collectionStack.push({
                    type: 'array',
                    values: [],
                    completionState: CompletionState.Incomplete
                })
                return 0
            case '"':
                this.collectionStack.push({
                    type: 'quotedString',
                    content: '',
                    completionState: CompletionState.Incomplete
                })
                return 0
            case "'":
                this.collectionStack.push({
                    type: 'singleQuotedString',
                    content: '',
                    completionState: CompletionState.Incomplete
                })
                return 0
            case '/':
                if (remaining[0] === '/') {
                    this.collectionStack.push({
                        type: 'trailingComment',
                        content: '',
                        completionState: CompletionState.Incomplete
                    })
                    return 1 // Skip the second '/'
                }
                if (remaining[0] === '*') {
                    this.collectionStack.push({
                        type: 'blockComment',
                        content: '',
                        completionState: CompletionState.Incomplete
                    })
                    return 1 // Skip the '*'
                }
            // Fall through to unquoted string
        }

        if (!token.match(/\s/)) {
            // Start unquoted string
            this.collectionStack.push({
                type: 'unquotedString',
                content: token,
                completionState: CompletionState.Incomplete
            })

            // Don't immediately check for closure when starting an unquoted string
            // Let it accumulate more characters first
        }

        return 0
    }

    private shouldCloseString(remaining: string[], position: number, closingChar: string): boolean {
        // Look ahead to determine if we should close the string
        const context = this.getParsingContext()

        let i = 0
        while (i < remaining.length) {
            const char = remaining[i]

            switch (char) {
                case ':':
                    if (context.inObjectKey) return true
                    break
                case '}':
                    if (context.inObjectKey || context.inObjectValue) return true
                    break
                case ',':
                    if (context.inObjectValue || context.inArray) return true
                    break
                case ']':
                    if (context.inArray) return true
                    break
                case ' ':
                case '\t':
                case '\n':
                    i++
                    continue
                case '{':
                case '[':
                case '"':
                case "'":
                    if (!context.hasParentObject) return true
                    break
                default:
                    return false
            }
            break
        }

        return remaining.length === 0
    }

    private shouldCloseUnquotedString(
        remaining: string[],
        position: number
    ): {
        shouldClose: boolean
        completionState: CompletionState
        skipCount: number
    } {
        const context = this.getParsingContext()
        const skipCount = 0

        for (let i = 0; i < remaining.length; i++) {
            const char = remaining[i]

            switch (char) {
                case ':':
                    if (context.inObjectKey) {
                        return { shouldClose: true, completionState: CompletionState.Complete, skipCount: i }
                    }
                    break
                case ',':
                    if (context.inObjectValue || context.inArray) {
                        return { shouldClose: true, completionState: CompletionState.Complete, skipCount: i }
                    }
                    break
                case '}':
                    if (context.inObjectKey || context.inObjectValue) {
                        return { shouldClose: true, completionState: CompletionState.Complete, skipCount: i }
                    }
                    break
                case ']':
                    if (context.inArray) {
                        return { shouldClose: true, completionState: CompletionState.Complete, skipCount: i }
                    }
                    break
                case '{':
                case '[':
                    if (!context.hasParentObject) {
                        return { shouldClose: true, completionState: CompletionState.Complete, skipCount: i }
                    }
                    break
                case '\n':
                    if (context.inObjectValue) {
                        return { shouldClose: true, completionState: CompletionState.Complete, skipCount: i }
                    }
                    break
            }
        }

        return { shouldClose: true, completionState: CompletionState.Incomplete, skipCount: remaining.length }
    }

    private getParsingContext() {
        const parentCollection = this.collectionStack[this.collectionStack.length - 2]

        if (!parentCollection) {
            return {
                hasParentObject: false,
                inObjectKey: false,
                inObjectValue: false,
                inArray: false
            }
        }

        switch (parentCollection.type) {
            case 'object':
                const objCollection = parentCollection as Extract<JsonCollection, { type: 'object' }>
                return {
                    hasParentObject: true,
                    inObjectKey: objCollection.keys.length === objCollection.values.length,
                    inObjectValue: objCollection.keys.length > objCollection.values.length,
                    inArray: false
                }
            case 'array':
                return {
                    hasParentObject: true,
                    inObjectKey: false,
                    inObjectValue: false,
                    inArray: true
                }
            default:
                return {
                    hasParentObject: true,
                    inObjectKey: false,
                    inObjectValue: false,
                    inArray: false
                }
        }
    }

    private consumeToken(token: string): void {
        const lastCollection = this.collectionStack[this.collectionStack.length - 1]

        if (lastCollection && 'content' in lastCollection) {
            lastCollection.content += token
        }
    }

    private completeCollection(completionState: CompletionState): void {
        const collection = this.collectionStack.pop()
        if (!collection) return

        const value = this.collectionToValue(collection, completionState)
        if (!value) return

        const parentCollection = this.collectionStack[this.collectionStack.length - 1]

        if (parentCollection) {
            this.addValueToParent(parentCollection, value)
        } else {
            this.completedValues.push({
                name: this.getCollectionName(collection),
                value
            })
        }
    }

    private collectionToValue(collection: JsonCollection, completionState: CompletionState): Value | null {
        switch (collection.type) {
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
            case 'unquotedString':
                return this.parseUnquotedString(collection.content, completionState)
            case 'trailingComment':
            case 'blockComment':
                return null // Comments are ignored
            default:
                return null
        }
    }

    private parseUnquotedString(content: string, completionState: CompletionState): Value {
        const trimmed = content.trim()

        // Try boolean
        if (trimmed.toLowerCase() === 'true') {
            return { type: 'boolean', value: true }
        }
        if (trimmed.toLowerCase() === 'false') {
            return { type: 'boolean', value: false }
        }

        // Try null
        if (trimmed.toLowerCase() === 'null') {
            return { type: 'null' }
        }

        // Try number
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

    private addValueToParent(parent: JsonCollection, value: Value): void {
        switch (parent.type) {
            case 'object': {
                const objParent = parent as Extract<JsonCollection, { type: 'object' }>
                if (objParent.keys.length === objParent.values.length) {
                    // This value is a key
                    const keyString = value.type === 'string' ? value.value : this.valueToString(value)
                    objParent.keys.push(keyString)
                } else {
                    // This value is a value
                    objParent.values.push(value)
                }
                break
            }
            case 'array': {
                const arrParent = parent as Extract<JsonCollection, { type: 'array' }>
                arrParent.values.push(value)
                break
            }
        }
    }

    private valueToString(value: Value): string {
        switch (value.type) {
            case 'string':
                return value.value
            case 'number':
                return value.value.toString()
            case 'boolean':
                return value.value.toString()
            case 'null':
                return 'null'
            default:
                return JSON.stringify(value)
        }
    }

    private getCollectionName(collection: JsonCollection): string {
        switch (collection.type) {
            case 'object':
                return 'Object'
            case 'array':
                return 'Array'
            case 'quotedString':
            case 'singleQuotedString':
            case 'unquotedString':
                return 'String'
            default:
                return 'Comment'
        }
    }

    private buildResult(): Value {
        if (this.completedValues.length === 0) {
            return {
                type: 'string',
                value: '',
                completionState: CompletionState.Incomplete
            }
        }

        if (this.completedValues.length === 1) {
            return this.completedValues[0].value
        }

        // Multiple values - filter for objects and arrays, or return all as array
        const objectsAndArrays = this.completedValues.filter((v) => v.name === 'Object' || v.name === 'Array')

        if (objectsAndArrays.length === 1) {
            return objectsAndArrays[0].value
        }

        // Return all values as an array
        return {
            type: 'array',
            value: this.completedValues.map((v) => v.value),
            completionState: CompletionState.Incomplete
        }
    }
}
