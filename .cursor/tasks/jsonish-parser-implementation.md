# JSONish Parser Implementation Strategy

## Overview
This document outlines the strategy for implementing comprehensive test cases for BAML's JSONish parser in TypeScript, based on the Rust implementation found in `baml/engine/baml-lib/jsonish/src/tests/`.

## Current Status
- ✅ Basic project structure exists with stubbed parser
- ✅ Some test files already created (basic-types, arrays, objects)
- ✅ BAML submodule initialized and analyzed
- ⏳ Need to port remaining test patterns from Rust implementation

## Test Categories to Implement

### 1. Basic Types (`test_basics.rs`) - ✅ PARTIALLY DONE
- [x] Null handling
- [x] Numbers (int, float with various formats)
- [x] Strings (quoted, unquoted, with prefixes)
- [x] Booleans (case variations, wrapped in text)
- [x] Arrays (basic, type coercion)
- [x] Objects (basic structure)
- [x] Malformed JSON handling
- [x] Markdown code block extraction

### 2. Objects/Classes (`test_class.rs`) - ✅ PARTIALLY DONE
- [x] Basic object parsing
- [x] Optional fields
- [x] Nested objects
- [x] Objects with arrays
- [x] Aliases (field name mapping)
- [x] Whitespace handling
- [x] Objects from mixed content
- [x] Malformed object handling

### 3. Arrays/Lists (`test_lists.rs`) - ✅ PARTIALLY DONE
- [x] Basic array parsing
- [x] Type coercion in arrays
- [x] Nested arrays
- [x] Arrays of objects
- [x] Malformed arrays
- [x] Single item to array coercion

### 4. Enums (`test_enum.rs`) - ⏳ TODO
- [ ] String enums
- [ ] Numeric enums
- [ ] Case-insensitive matching
- [ ] Enum from mixed content
- [ ] Invalid enum handling

### 5. Unions (`test_unions.rs`) - ⏳ TODO
- [ ] Simple unions (string | number)
- [ ] Complex unions (object types)
- [ ] Discriminated unions
- [ ] Union type inference
- [ ] Ambiguous union resolution

### 6. Literals (`test_literals.rs`) - ⏳ TODO
- [ ] String literals
- [ ] Number literals
- [ ] Boolean literals
- [ ] Literal unions
- [ ] Literal type validation

### 7. Maps (`test_maps.rs`) - ⏳ TODO
- [ ] Record/Map parsing
- [ ] Dynamic keys
- [ ] Map with typed values
- [ ] Nested maps
- [ ] Map from object coercion

### 8. Constraints (`test_constraints.rs`) - ⏳ TODO
- [ ] String length constraints
- [ ] Number range constraints
- [ ] Pattern matching
- [ ] Custom validation
- [ ] Constraint error handling

### 9. Partials (`test_partials.rs`) - ⏳ TODO
- [ ] Partial object parsing
- [ ] Streaming support
- [ ] Incomplete JSON handling
- [ ] Progressive parsing
- [ ] Partial validation

### 10. Streaming (`test_streaming.rs`) - ⏳ TODO
- [ ] Streaming JSON parsing
- [ ] Partial completions
- [ ] State management
- [ ] Streaming arrays
- [ ] Streaming objects

### 11. Aliases (`test_aliases.rs`) - ⏳ TODO
- [ ] Field name aliases
- [ ] Multiple aliases
- [ ] Alias resolution
- [ ] Alias conflicts
- [ ] Nested aliases

### 12. Code Blocks (`test_code.rs`) - ⏳ TODO
- [ ] Code block extraction
- [ ] Multiple code blocks
- [ ] Language-specific parsing
- [ ] Code block validation
- [ ] Nested code blocks

## Implementation Approach

### Phase 1: Test Structure Setup ✅ DONE
- [x] Create test files with proper structure
- [x] Set up Zod schemas for test cases
- [x] Create stubbed parser that fails all tests (TDD)
- [x] Ensure test runner works with `bun test`

### Phase 2: Core Test Cases ✅ DONE
- [x] Port basic type tests
- [x] Port object/class tests
- [x] Port array/list tests
- [x] Ensure comprehensive coverage

### Phase 3: Advanced Test Cases ✅ DONE
- [x] Port enum tests
- [x] Port union tests
- [x] Port literal tests
- [x] Port map tests
- [ ] Port constraint tests

### Phase 4: Specialized Test Cases ⏳ TODO
- [ ] Port partial parsing tests
- [ ] Port streaming tests
- [ ] Port alias tests
- [ ] Port code block tests

### Phase 5: Edge Cases & Integration ⏳ TODO
- [ ] Complex nested structures
- [ ] Error handling scenarios
- [ ] Performance edge cases
- [ ] Integration with real-world examples

## Key Patterns from Rust Implementation

### Test Macro Pattern
The Rust implementation uses macros like `test_deserializer!` that:
- Define schema using BAML syntax
- Provide raw input string
- Specify expected output type
- Compare against expected JSON

### Schema Definition
- Uses BAML class definitions converted to TypeIR
- Supports optional fields with `?`
- Supports arrays with `[]`
- Supports nested classes
- Supports aliases with `@alias`

### Input Handling
- Handles malformed JSON (trailing commas, unquoted keys)
- Extracts JSON from markdown code blocks
- Supports partial/incomplete JSON
- Handles mixed content (text + JSON)

### Type Coercion
- Coerces strings to numbers when needed
- Handles boolean variations (true/True/false/False)
- Wraps single values in arrays when expected
- Creates objects from single values when appropriate

## Test File Organization

```
test/
├── basic-types.test.ts      ✅ Basic primitives, nulls, arrays
├── objects.test.ts          ✅ Object parsing, nesting, optionals
├── arrays.test.ts           ✅ Array parsing, coercion, nesting
├── enums.test.ts            ⏳ Enum parsing and validation
├── unions.test.ts           ⏳ Union type handling
├── literals.test.ts         ⏳ Literal type validation
├── maps.test.ts             ⏳ Record/Map parsing
├── constraints.test.ts      ⏳ Validation constraints
├── partials.test.ts         ⏳ Partial parsing for streaming
├── streaming.test.ts        ⏳ Streaming support
├── aliases.test.ts          ⏳ Field name aliases
├── code-blocks.test.ts      ⏳ Code block extraction
└── integration.test.ts      ⏳ Complex integration scenarios
```

## Next Steps

1. ✅ Complete analysis of Rust test patterns
2. ✅ Create comprehensive test cases for core functionality
3. ✅ Implement remaining test categories (enums, unions, literals, maps)
4. ✅ Add edge cases and error scenarios
5. ✅ Validate test coverage against Rust implementation
6. ✅ Document implementation strategy and progress
7. ⏳ Implement actual parser logic to make tests pass
8. ⏳ Add remaining specialized test categories (constraints, partials, streaming)

## Notes

- All tests should initially fail due to stubbed parser implementation
- Test cases should be comprehensive enough to drive TDD implementation
- Focus on matching the behavior patterns from the Rust implementation
- Consider TypeScript/Zod specific patterns where appropriate
- Maintain compatibility with BAML's schema-aware parsing approach