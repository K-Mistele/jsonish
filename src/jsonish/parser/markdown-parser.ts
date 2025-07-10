import type { Value } from '../../value'
import type { ParseOptions } from './entry'

/**
 * Result type for markdown parsing
 * Mirrors the MarkdownResult enum from Rust
 */
export type MarkdownResult = { type: 'codeBlock'; tag: string; value: Value } | { type: 'string'; value: string }

/**
 * Represents the different parsing modes
 * Mirrors the ParsingMode enum from Rust
 */
export enum ParsingMode {
    JsonMarkdown = 'json_markdown',
    JsonMarkdownString = 'json_markdown_string',
    AllJsonObjects = 'all_json_objects'
}

/**
 * Creates parsing options for the next parsing mode
 * Mirrors the next_from_mode function from Rust
 */
export function nextFromMode(options: ParseOptions, mode: ParsingMode): ParseOptions {
    const newOptions = { ...options }

    switch (mode) {
        case ParsingMode.JsonMarkdownString:
            newOptions.allowMarkdownJson = false
            newOptions.allowAsString = true
            break
        case ParsingMode.JsonMarkdown:
            newOptions.allowMarkdownJson = false
            newOptions.allowAsString = false
            break
        case ParsingMode.AllJsonObjects:
            newOptions.allFindingAllJsonObjects = false
            newOptions.allowAsString = false
            break
    }

    return newOptions
}

/**
 * Parse markdown content and extract JSON from code blocks
 * Mirrors the parse function from Rust markdown_parser.rs
 *
 * @param str Input string that may contain markdown code blocks
 * @param options Parsing options
 * @param parseFunc Function to parse the content within code blocks
 * @returns Array of MarkdownResult items
 */
export function parse(
    str: string,
    options: ParseOptions,
    parseFunc: (content: string, options: ParseOptions, isDone: boolean) => Value
): MarkdownResult[] {
    const results: MarkdownResult[] = []

    // Regex patterns to match markdown code blocks
    // Matches ```<tag><EOF|newline>
    const mdTagStartRegex = /```([a-zA-Z0-9 ]+)(?:\n|$)/g
    const mdTagEndRegex = /```(?:\n|$)/g

    let remaining = str
    let shouldLoop = true

    while (shouldLoop) {
        // Find the next markdown code block start
        const startMatch = mdTagStartRegex.exec(remaining)
        if (!startMatch) {
            break
        }

        const tag = startMatch[1].trim()
        const contentStart = startMatch.index + startMatch[0].length

        // Find the corresponding end marker
        mdTagEndRegex.lastIndex = contentStart
        const endMatch = mdTagEndRegex.exec(remaining)

        let mdContent: string
        let nextRemaining: string

        if (endMatch) {
            // Found closing marker
            mdContent = remaining.slice(contentStart, endMatch.index).trim()
            nextRemaining = remaining.slice(endMatch.index + endMatch[0].length)
        } else {
            // No closing marker found, take rest of string
            mdContent = remaining.slice(contentStart).trim()
            nextRemaining = ''
            shouldLoop = false
        }

        // Parse the content within the code block
        if (mdContent.length > 0) {
            try {
                const parsedValue = parseFunc(mdContent, nextFromMode(options, ParsingMode.JsonMarkdown), false)

                results.push({
                    type: 'codeBlock',
                    tag: tag || '<unspecified>',
                    value: parsedValue
                })
            } catch (error) {
                // Log error but continue processing
                console.debug(`Error parsing markdown block with tag '${tag}':`, error)
            }
        }

        remaining = nextRemaining

        // Reset regex lastIndex for next iteration
        mdTagStartRegex.lastIndex = 0
        mdTagEndRegex.lastIndex = 0
    }

    if (results.length === 0) {
        throw new Error('No markdown blocks found')
    }

    // Add remaining content as string if not empty
    if (remaining.trim().length > 0) {
        results.push({
            type: 'string',
            value: remaining
        })
    }

    return results
}

/**
 * Convenience function to create a CodeBlock result
 */
export function createCodeBlock(tag: string, value: Value): MarkdownResult {
    return { type: 'codeBlock', tag, value }
}

/**
 * Convenience function to create a String result
 */
export function createString(value: string): MarkdownResult {
    return { type: 'string', value }
}

/**
 * Type guard to check if a result is a CodeBlock
 */
export function isCodeBlock(result: MarkdownResult): result is { type: 'codeBlock'; tag: string; value: Value } {
    return result.type === 'codeBlock'
}

/**
 * Type guard to check if a result is a String
 */
export function isString(result: MarkdownResult): result is { type: 'string'; value: string } {
    return result.type === 'string'
}
