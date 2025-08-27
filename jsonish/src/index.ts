import type z from 'zod'

/**
 * The main entrypoint for the parser
 * @param llmGeneratedResponse
 * @param schema
 * @returns
 */
import { parseBasic } from './parser.js'

export interface ParseOptions {
    allowPartial?: boolean;
    allowMalformed?: boolean;
    allowAsString?: boolean;
    allowMarkdownJson?: boolean;
    allowFixes?: boolean;
}

export interface Parser {
    parse<T extends z.ZodType>(input: string, schema: T, options?: ParseOptions): z.infer<T>
}

export function createParser(): Parser {
    return {
        parse<T extends z.ZodType>(input: string, schema: T, options?: ParseOptions): z.infer<T> {
            return parseBasic(input, schema, options)
        }
    }
}

export function parse<T extends z.ZodType>(input: string, schema: T, options?: ParseOptions): z.infer<T> {
    return createParser().parse(input, schema, options)
}
