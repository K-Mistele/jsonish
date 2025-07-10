import { CompletionState, type Fixes, type Value } from '../../../value'
import { type JsonCollection, collectionToValue, getCollectionName } from './json-collection'

/**
 * Represents different parsing positions/contexts
 * Mirrors the Pos enum from Rust implementation
 */
enum Pos {
    InNothing = 0, // Top level, not in any structure
    Unknown = 1, // Continue parsing
    InObjectKey = 2, // Parsing an object key
    InObjectValue = 3, // Parsing an object value
    InArray = 4 // Parsing an array element
}

/**
 * Result of attempting to close a string
 */
export enum CloseStringResult {
    Close = 0,
    Continue = 1
}

/**
 * Core state management for JSON parsing
 * Mirrors the JsonParseState struct from Rust implementation
 */
export class JsonParseState {
    /**
     * The stack of JSON collection values being assembled.
     * The stack-ness is used to parse nested values,
     * e.g. an object with fields of list, or lists of lists.
     */
    public collectionStack: Array<{ collection: JsonCollection; fixes: Fixes[] }> = []

    /**
     * Values for which parsing is completed, and popped off of the
     * collection stack.
     * Technically we may find multiple values in a single string
     */
    public completedValues: Array<{ name: string; value: Value; fixes: Fixes[] }> = []

    /**
     * Create a new JsonParseState instance
     */
    constructor() {
        this.reset()
    }

    /**
     * Reset the state for a new parsing session
     */
    public reset(): void {
        this.collectionStack = []
        this.completedValues = []
    }

    /**
     * Complete the current collection with the given completion state
     */
    public completeCollection(completionState: CompletionState): void {
        const stackItem = this.collectionStack.pop()
        if (!stackItem) return

        const { collection, fixes } = stackItem
        const value = collectionToValue(collection, completionState)
        if (!value) return

        const parentStackItem = this.collectionStack[this.collectionStack.length - 1]

        if (parentStackItem) {
            this.addValueToParent(parentStackItem.collection, value)
        } else {
            this.completedValues.push({
                name: getCollectionName(collection),
                value,
                fixes
            })
        }
    }

    /**
     * Consume a token into the current collection
     */
    public consume(token: string): number {
        const stackItem = this.collectionStack[this.collectionStack.length - 1]
        if (!stackItem) return 0

        const { collection } = stackItem
        if ('content' in collection) {
            collection.content += token
        }

        return 0
    }

    /**
     * Check if the current string is complete
     */
    public isStringComplete(): boolean {
        const stackItem = this.collectionStack[this.collectionStack.length - 1]
        if (!stackItem) return true

        const { collection } = stackItem
        // Access completionState based on collection type
        switch (collection.type) {
            case 'object':
            case 'array':
                return collection.completionState === CompletionState.Complete
            case 'tripleBacktickString':
                return collection.content.completionState === CompletionState.Complete
            default:
                // String types and comments have direct completionState field
                return collection.completionState === CompletionState.Complete
        }
    }

    /**
     * Determine if we should close an unescaped string
     * Returns the number of characters to skip and the completion state
     */
    public shouldCloseUnescapedString(next: Iterable<[number, string]>): {
        shouldClose: boolean
        skipCount: number
        completionState: CompletionState
    } {
        const pos = this.getCurrentPos()

        switch (pos) {
            case Pos.InNothing: {
                // Top level - look for new objects/arrays
                const nextArray = Array.from(next)
                for (let i = 0; i < nextArray.length; i++) {
                    const [, char] = nextArray[i]
                    if (char === '{' || char === '[') {
                        return { shouldClose: true, skipCount: i, completionState: CompletionState.Complete }
                    }
                    // Consume character into current string
                    this.consume(char)
                }
                return { shouldClose: true, skipCount: nextArray.length, completionState: CompletionState.Incomplete }
            }

            case Pos.Unknown: {
                // Continue - don't close
                return { shouldClose: false, skipCount: 0, completionState: CompletionState.Incomplete }
            }

            case Pos.InObjectKey: {
                // Object key - close on ':'
                const nextArray = Array.from(next)
                for (let i = 0; i < nextArray.length; i++) {
                    const [, char] = nextArray[i]
                    if (char === ':') {
                        return { shouldClose: true, skipCount: i, completionState: CompletionState.Complete }
                    }
                    // Consume character into current string
                    this.consume(char)
                }
                return { shouldClose: true, skipCount: nextArray.length, completionState: CompletionState.Incomplete }
            }

            case Pos.InObjectValue: {
                // Object value - close on ',' or '}'
                const nextArray = Array.from(next)
                for (let i = 0; i < nextArray.length; i++) {
                    const [, char] = nextArray[i]
                    if (char === ',') {
                        // Check if next character is newline (special case)
                        if (i + 1 < nextArray.length && nextArray[i + 1][1] === '\n') {
                            return { shouldClose: true, skipCount: i, completionState: CompletionState.Complete }
                        }
                        // Check if this is the last character (end of input case)
                        if (i + 1 >= nextArray.length) {
                            return { shouldClose: true, skipCount: i, completionState: CompletionState.Complete }
                        }
                        // Regular comma - consume it and continue
                        this.consume(char)
                    } else if (char === '}') {
                        return { shouldClose: true, skipCount: i, completionState: CompletionState.Complete }
                    } else {
                        // Consume character into current string
                        this.consume(char)
                    }
                }
                return { shouldClose: true, skipCount: nextArray.length, completionState: CompletionState.Incomplete }
            }

            case Pos.InArray: {
                // Array - close on ',' or ']'
                const nextArray = Array.from(next)
                for (let i = 0; i < nextArray.length; i++) {
                    const [, char] = nextArray[i]
                    if (char === ',' || char === ']') {
                        return { shouldClose: true, skipCount: i, completionState: CompletionState.Complete }
                    }
                    // Consume character into current string
                    this.consume(char)
                }
                return { shouldClose: true, skipCount: nextArray.length, completionState: CompletionState.Incomplete }
            }

            default:
                return { shouldClose: true, skipCount: 0, completionState: CompletionState.Incomplete }
        }
    }

    /**
     * Determine if we should close a quoted string
     */
    public shouldCloseString(next: Iterable<[number, string]>, closingChar: string): boolean {
        const context = this.getParsingContext()
        const nextArray = Array.from(next)

        let i = 0
        while (i < nextArray.length) {
            const [, char] = nextArray[i]

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

        return nextArray.length === 0
    }

    /**
     * Process a token and return the number of characters to skip
     */
    public processToken(token: string, next: Iterable<[number, string]>): number {
        const stackItem = this.collectionStack[this.collectionStack.length - 1]

        if (!stackItem) {
            return this.findAnyStartingValue(token, next)
        }

        const { collection } = stackItem
        switch (collection.type) {
            case 'object':
                return this.processObjectToken(token, next)
            case 'array':
                return this.processArrayToken(token, next)
            case 'quotedString':
                return this.processQuotedStringToken(token, next, '"')
            case 'tripleQuotedString':
                return this.processTripleQuotedStringToken(token, next)
            case 'singleQuotedString':
                return this.processQuotedStringToken(token, next, "'")
            case 'unquotedString':
                return this.processUnquotedStringToken(token, next)
            case 'trailingComment':
                return this.processTrailingCommentToken(token, next)
            case 'blockComment':
                return this.processBlockCommentToken(token, next)
            default:
                return 0
        }
    }

    /**
     * Find any starting value from the current token
     */
    public findAnyStartingValue(token: string, next: Iterable<[number, string]>): number {
        switch (token) {
            case '{':
                this.collectionStack.push({
                    collection: {
                        type: 'object',
                        keys: [],
                        values: [],
                        completionState: CompletionState.Incomplete
                    },
                    fixes: []
                })
                return 0
            case '[':
                this.collectionStack.push({
                    collection: {
                        type: 'array',
                        values: [],
                        completionState: CompletionState.Incomplete
                    },
                    fixes: []
                })
                return 0
            case '"': {
                const nextArray = Array.from(next)
                // Check for triple quotes
                if (nextArray[0]?.[1] === '"' && nextArray[1]?.[1] === '"') {
                    this.collectionStack.push({
                        collection: {
                            type: 'tripleQuotedString',
                            content: '',
                            completionState: CompletionState.Incomplete
                        },
                        fixes: []
                    })
                    return 2 // Skip the next two quotes
                }

                this.collectionStack.push({
                    collection: {
                        type: 'quotedString',
                        content: '',
                        completionState: CompletionState.Incomplete
                    },
                    fixes: []
                })
                return 0
            }
            case "'":
                this.collectionStack.push({
                    collection: {
                        type: 'singleQuotedString',
                        content: '',
                        completionState: CompletionState.Incomplete
                    },
                    fixes: []
                })
                return 0
            case '/': {
                const nextArray = Array.from(next)
                if (nextArray[0]?.[1] === '/') {
                    this.collectionStack.push({
                        collection: {
                            type: 'trailingComment',
                            content: '',
                            completionState: CompletionState.Incomplete
                        },
                        fixes: []
                    })
                    return 1 // Skip the second '/'
                }
                if (nextArray[0]?.[1] === '*') {
                    this.collectionStack.push({
                        collection: {
                            type: 'blockComment',
                            content: '',
                            completionState: CompletionState.Incomplete
                        },
                        fixes: []
                    })
                    return 1 // Skip the '*'
                }
                // Fall through to unquoted string
            }
        }

        if (!token.match(/\s/)) {
            // Start unquoted string
            this.collectionStack.push({
                collection: {
                    type: 'unquotedString',
                    content: token,
                    completionState: CompletionState.Incomplete
                },
                fixes: []
            })

            // Check immediately if we should close the string
            const closeResult = this.shouldCloseUnescapedString(next)
            if (closeResult.shouldClose) {
                this.completeCollection(closeResult.completionState)
                return closeResult.skipCount
            }
        }

        return 0
    }

    // Helper methods

    private getCurrentPos(): Pos {
        if (this.collectionStack.length < 2) {
            return Pos.InNothing
        }

        const parentStackItem = this.collectionStack[this.collectionStack.length - 2]
        const { collection: parentCollection } = parentStackItem

        switch (parentCollection.type) {
            case 'object':
                const objCollection = parentCollection as Extract<JsonCollection, { type: 'object' }>
                return objCollection.keys.length === objCollection.values.length ? Pos.InObjectKey : Pos.InObjectValue
            case 'array':
                return Pos.InArray
            default:
                return Pos.Unknown
        }
    }

    private getParsingContext() {
        const parentStackItem = this.collectionStack[this.collectionStack.length - 2]

        if (!parentStackItem) {
            return {
                hasParentObject: false,
                inObjectKey: false,
                inObjectValue: false,
                inArray: false
            }
        }

        const { collection: parentCollection } = parentStackItem
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

    // Token processing methods (simplified for now)
    private processObjectToken(token: string, next: Iterable<[number, string]>): number {
        switch (token) {
            case '}':
                this.completeCollection(CompletionState.Complete)
                return 0
            case ',':
            case ':':
                return 0 // Skip these tokens
            default:
                return this.findAnyStartingValue(token, next)
        }
    }

    private processArrayToken(token: string, next: Iterable<[number, string]>): number {
        switch (token) {
            case ']':
                this.completeCollection(CompletionState.Complete)
                return 0
            case ',':
                return 0 // Skip comma
            default:
                return this.findAnyStartingValue(token, next)
        }
    }

    private processQuotedStringToken(token: string, next: Iterable<[number, string]>, closingChar: string): number {
        if (token === closingChar) {
            if (this.shouldCloseString(next, closingChar)) {
                this.completeCollection(CompletionState.Complete)
                return 0
            }
        }

        this.consume(token)
        return 0
    }

    private processTripleQuotedStringToken(token: string, next: Iterable<[number, string]>): number {
        if (token === '"') {
            const nextArray = Array.from(next)
            // Check if this is the end of triple quotes
            if (nextArray[0]?.[1] === '"' && nextArray[1]?.[1] === '"') {
                if (this.shouldCloseString([...nextArray.slice(2)].values(), '"""')) {
                    this.completeCollection(CompletionState.Complete)
                    return 2 // Skip the next two quotes
                }
            }
        }

        this.consume(token)
        return 0
    }

    private processUnquotedStringToken(token: string, next: Iterable<[number, string]>): number {
        this.consume(token)

        const closeResult = this.shouldCloseUnescapedString(next)
        if (closeResult.shouldClose) {
            this.completeCollection(closeResult.completionState)
            return closeResult.skipCount
        }

        return 0
    }

    private processTrailingCommentToken(token: string, next: Iterable<[number, string]>): number {
        if (token === '\n') {
            this.completeCollection(CompletionState.Complete)
            return 0
        }

        this.consume(token)
        return 0
    }

    private processBlockCommentToken(token: string, next: Iterable<[number, string]>): number {
        if (token === '*') {
            const nextArray = Array.from(next)
            if (nextArray[0]?.[1] === '/') {
                this.completeCollection(CompletionState.Complete)
                return 1 // Skip the '/' as well
            }
        }

        this.consume(token)
        return 0
    }
}
