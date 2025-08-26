import z from 'zod'

const exampleSchema = z.object({ name: z.string() })

/**
 * The main entrypoint for the parser
 * @param llmGeneratedResponse
 * @param schema
 * @returns
 */
import { z } from 'zod';
import { parseBasic } from './parser.js';

export interface Parser {
  parse<T extends z.ZodType>(input: string, schema: T): z.infer<T>;
}

export function createParser(): Parser {
  return {
    parse<T extends z.ZodType>(input: string, schema: T): z.infer<T> {
      return parseBasic(input, schema);
    }
  };
}

export function parse<T extends z.ZodType>(input: string, schema: T): z.infer<T> {
  return createParser().parse(input, schema);
}
