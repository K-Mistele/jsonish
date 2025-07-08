# JSONish Parser TypeScript Implementation Strategy

## Overview
Create a TypeScript implementation of BAML's JSONish parser test suite using Zod for schema-aware parsing. The goal is to replicate BAML's ability to parse JSON-like content into strongly typed objects based on expected schemas.

## Implementation Plan

### Phase 1: Core Infrastructure ✅
- [x] Create parser interface with Zod integration
- [x] Set up test utilities and helper functions
- [x] Configure test runner in package.json
- [x] Create basic project structure

### Phase 2: Basic Type Tests
- [ ] String parsing (quoted, unquoted, with escapes)
- [ ] Number parsing (int, float, with formatting)
- [ ] Boolean parsing (true/false, case variations)
- [ ] Null parsing
- [ ] Basic array parsing

### Phase 3: Complex Type Tests
- [ ] Object parsing with nested structures
- [ ] Array parsing with mixed types
- [ ] Union type parsing
- [ ] Optional field handling
- [ ] Map/record parsing

### Phase 4: Advanced Features
- [ ] Enum parsing with aliases
- [ ] Recursive type parsing
- [ ] Constraint validation
- [ ] Error handling and recovery
- [ ] Markdown code block extraction

### Phase 5: Edge Cases
- [ ] Malformed JSON handling
- [ ] Partial/streaming content
- [ ] Mixed content with prefixes/suffixes
- [ ] Comments in JSON
- [ ] Trailing commas

## Test Categories

### 1. Basic Types (`test/basic-types.test.ts`)
- String, number, boolean, null parsing
- Type coercion and validation
- Edge cases like comma-separated numbers

### 2. Arrays (`test/arrays.test.ts`)
- Homogeneous and heterogeneous arrays
- Nested arrays
- Single value to array coercion

### 3. Objects (`test/objects.test.ts`)
- Simple and nested objects
- Optional fields
- Field aliases
- Recursive structures

### 4. Unions (`test/unions.test.ts`)
- Type discrimination
- Best match selection
- Union with primitives and objects

### 5. Enums (`test/enums.test.ts`)
- String enums with aliases
- Case-insensitive matching
- Substring matching

### 6. Maps (`test/maps.test.ts`)
- String-keyed maps
- Type validation for values
- Optional vs required maps

### 7. Edge Cases (`test/edge-cases.test.ts`)
- Malformed JSON
- Mixed content
- Markdown extraction
- Error recovery

## Parser Interface

```typescript
interface JsonishParser {
  parse<T>(input: string, schema: z.ZodSchema<T>): T;
}
```

## Test Structure

Each test follows the pattern:
```typescript
describe('feature', () => {
  it('should parse specific case', () => {
    const schema = z.object({ ... });
    const input = '...';
    const expected = { ... };
    
    const result = parser.parse(input, schema);
    expect(result).toEqual(expected);
  });
});
```

## Key Features to Replicate

1. **Schema-aware parsing**: Use expected Zod schema to guide parsing
2. **Error tolerance**: Handle malformed JSON gracefully
3. **Type coercion**: Convert between compatible types
4. **Content extraction**: Find JSON in mixed text content
5. **Markdown support**: Extract from code blocks
6. **Partial parsing**: Handle incomplete content

## Progress Tracking

- **Total Test Files**: 0/7
- **Total Test Cases**: 0/~200
- **Current Phase**: Phase 1 (Infrastructure)
- **Next Steps**: Implement basic type parsing tests

## Notes

- All tests should initially fail (TDD approach)
- Parser implementation is stubbed to return empty object
- Focus on comprehensive test coverage before implementation
- Use Zod's type inference for strong typing
- Mirror BAML's test patterns and edge cases