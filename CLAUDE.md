 # CLAUDE.md

  This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
JSONish is a TypeScript library that provides a robust, schema-aware JSON parser capable of handling malformed JSON and mixed
content. It's a TypeScript port of BAML's Rust-based JSONish parser, using zod for schema definition, parsing and coercion rather than BAML's language-specific features.

We are using TDD, based on the tests in `test/`. Run tests frequently as you implement functionality to avoid regressions.

Translate *only* BAML's JSONish parser into typescript. do not include BAML language-specific features or any DSL-related functionality. 

Instead, use typescript and zod (with  zod's JSON schema functionality - https://zod.dev/json-schema) to define schemas for extraction and coercion from LLM outputs, but make sure to support zod's  refinements, mutations etc; and to support the various output formats the BAML does.(e.g. triple quote blocks for strings) as well as all the other extractable types; just map BAML types to JS/TS where appropriate. 

The main entrypoint to the package should be a parse() function where I pass in a string containing and LLM output string with the structured output json object which may be incomplete or irregular, and a zod schema to extract/coerce it to, and the function returns the extracted object if possible or throws an error. Use the following signature for the entrypoint:

`function parse<T extends z.ZodType>(text: string, schema: T): z.infer<T>`

## Key Features

  1. **Malformed JSON Parsing**: Handles missing commas, trailing commas, single quotes, and comments
  2. **Mixed Content Support**: Extracts JSON from text/markdown content
  3. **Intelligent Type Coercion**: Converts values to match expected schemas using Zod
  4. **Streaming Support**: Parses partial/streaming JSON data
  5. **Union Type Resolution**: Intelligently selects best matching type from unions
  6. **Error Recovery**: Attempts to fix common JSON errors automatically
  7. **Partial Parsing**: Can work with incomplete JSON structures
  8. **Schema Validation**: Uses Zod for runtime type checking and validation

## Development Commands

  ```bash
  # Install dependencies
  bun install

  # Run tests (236+ test cases)
  # NOT bun test - this will also match tests in the baml/ codebase which we don't want.
  bun run tests 

  # Run specific test file
  bun test ./test/basics.test.ts

  # Build the project
  bun build

  # Type check (through build process)
  bun build:declaration
```


## Parser System

  - Entry Point: src/jsonish/parser/entry_parser.ts
  - Error Recovery: src/jsonish/parser/fixing-parser/ - Attempts to fix common JSON errors
  - Value Representation: src/jsonish/value.ts - Internal representation of parsed values

## Testing Approach
  The project uses Bun's built-in test runner with comprehensive test coverage:
  - test/basics.test.ts - Fundamental parsing tests
  - test/class-*.test.ts - Object/class parsing scenarios
  - test/enum.test.ts - Enum value parsing
  - test/unions.test.ts - Union type resolution
  - test/streaming.test.ts - Partial/streaming JSON parsing
  - test/partials.test.ts - Incomplete object handling

## Important Notes

  - This is a TypeScript port of the Rust implementation
  - Uses Bun as both runtime and package manager
  - Zod is used for schema definition and validation
  - The parser is designed to be forgiving and handle real-world malformed JSON
  - Error recovery is a key feature - the parser attempts to fix common mistakes
  - typescript implementation should be structurally and architecturally as similar to the original jsonish rust implementation as possible, except where BAML-specific language features are used. we want to only use typescript and zod and don't care about BAML-specific capabilities or features, so these can be ignored.

## Resources

  - Original Rust implementation: Part of the BAML project
  - Zod documentation: https://zod.dev/
  - Bun documentation: https://bun.sh/
  - Rust source code: `./baml/engine/baml-lib/jsonish`