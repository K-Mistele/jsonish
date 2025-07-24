# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JSONish is a TypeScript library that provides a robust, schema-aware JSON parser capable of handling malformed JSON and mixed content. It's a TypeScript port of BAML's Rust-based JSONish parser.

## Key Features

1. **Malformed JSON Parsing**: Handles missing commas, trailing commas, single quotes, and comments
2. **Mixed Content Support**: Extracts JSON from text/markdown content
3. **Intelligent Type Coercion**: Converts values to match expected schemas using Zod
4. **Streaming Support**: Parses partial/streaming JSON data
5. **Union Type Resolution**: Intelligently selects best matching type from unions
6. **Error Recovery**: Attempts to fix common JSON errors automatically
7. **Partial Parsing**: Can work with incomplete JSON structures
8. **Schema Validation**: Uses Zod for runtime type checking and validation

## Project Structure

```
src/
├── deserializer/        # Type coercion and deserialization system
│   ├── coercer/        # Type-specific coercion implementations
│   │   ├── ir_ref/     # Internal representations (alias, class, enum)
│   │   ├── array_coercer.ts
│   │   ├── literal_coercer.ts
│   │   ├── map_coercer.ts
│   │   ├── primitive_coercer.ts
│   │   └── union_coercer.ts
│   ├── deserializer.ts  # Main deserializer implementation
│   ├── flags.ts         # Parsing flags and options
│   └── score.ts         # Type matching score system
├── helpers/             # Utility functions
└── jsonish/            # Core parser implementation
    ├── parser/         # Parsing logic
    │   ├── fixing-parser/  # Error recovery mechanisms
    │   └── entry_parser.ts # Main parser entry point
    └── value.ts        # Value representation types
```

## Development Commands

```bash
# Install dependencies
bun install

# Run tests (236+ test cases)
bun test

# Run specific test file
bun test ./test/basics.test.ts

# Build the project
bun build

# Type check (through build process)
bun build:declaration
```

## Architecture Overview

### Parser System
- **Entry Point**: `src/jsonish/parser/entry_parser.ts`
- **Error Recovery**: `src/jsonish/parser/fixing-parser/` - Attempts to fix common JSON errors
- **Value Representation**: `src/jsonish/value.ts` - Internal representation of parsed values

### Deserializer System
- **Main Logic**: `src/deserializer/deserializer.ts`
- **Type Coercion**: Individual coercers in `src/deserializer/coercer/` handle different type conversions
- **Scoring System**: `src/deserializer/score.ts` - Determines best type match for ambiguous cases

## Testing Approach

The project uses Bun's built-in test runner with comprehensive test coverage:
- `test/basics.test.ts` - Fundamental parsing tests
- `test/class-*.test.ts` - Object/class parsing scenarios
- `test/enum.test.ts` - Enum value parsing
- `test/unions.test.ts` - Union type resolution
- `test/streaming.test.ts` - Partial/streaming JSON parsing
- `test/partials.test.ts` - Incomplete object handling

## Code Style Guidelines

The project uses Biome for formatting and linting:
- 4-space indentation
- Single quotes for strings
- 120 character line width
- Semicolons as needed
- TypeScript strict mode enabled

## Common Development Tasks

### Adding a New Coercer
1. Create new file in `src/deserializer/coercer/`
2. Implement the coercer interface
3. Add corresponding tests in `test/`
4. Update the main deserializer to use the new coercer

### Debugging Parser Issues
1. Check `test/` for similar test cases
2. Use the error recovery system in `fixing-parser/`
3. Examine the scoring system for type resolution issues

## Implementation Status

**Current State**: Test suite is complete (236+ tests), parser implementation is in progress.

The TypeScript implementation aims to match the behavior of the original Rust parser while leveraging TypeScript/JavaScript ecosystem tools like Zod for schema validation.

## Important Notes

- This is a TypeScript port of the Rust implementation
- Uses Bun as both runtime and package manager
- Zod is used for schema definition and validation
- The parser is designed to be forgiving and handle real-world malformed JSON
- Error recovery is a key feature - the parser attempts to fix common mistakes

## Resources

- Original Rust implementation: Part of the BAML project
- Zod documentation: https://zod.dev/
- Bun documentation: https://bun.sh/