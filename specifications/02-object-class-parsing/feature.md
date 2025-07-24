---
date: 2025-01-23T22:47:00-08:00
researcher: Claude Code
git_commit: 4e974c5db60f8c7dd723a17d38948bae5afc488f
branch: master
repository: jsonish
topic: "Object and Class Parsing Feature Specification"
tags: [feature-spec, object-parsing, class-parsing, nested-objects, type-coercion, recursive-parsing]
status: complete
last_updated: 2025-01-23
last_updated_by: Claude Code
type: feature-specification
parent_requirements: specifications/requirements.md
test_file: test/class.test.ts
test_count: 68
---

# Object and Class Parsing Feature Specification

## Overview

This specification defines the object and class parsing capabilities of the JSONish parser based on comprehensive test coverage in `test/class.test.ts`. The parser must handle complex object structures with intelligent type coercion, nested objects, optional/nullable fields, and various formatting scenarios while maintaining schema awareness.

## Feature Categories

### 1. Basic Object Parsing

**Core Capability**: Parse standard JSON objects with type coercion and schema validation.

**Key Features**:
- Simple object parsing with primitive types (string, number, boolean)
- Array field handling within objects
- Multi-field object parsing with mixed types
- Automatic array wrapping when schema expects array of objects

**Test Coverage**: 4 tests
- Simple object with string array: `{"hi": ["a", "b"]}`
- Object wrapping in array when expected: `{"hi": "a"}` → `[{ hi: ["a"] }]`
- Multi-field objects with various types
- Objects containing array fields

### 2. Object Extraction from Mixed Content

**Core Capability**: Extract JSON objects from text, markdown, and mixed content scenarios.

**Key Features**:
- Extract objects from text with prefix/suffix content
- Handle markdown code blocks with ```json formatting
- Process multiple JSON objects in text, selecting first schema-matching one
- Support extraction without code block formatting

**Test Coverage**: 6 tests
- Prefix text extraction: `'The output is: {"hi": ["a", "b"]}'`
- Suffix text extraction: `'{"hi": ["a", "b"]} is the output.'`
- Markdown code block extraction with multiple JSON objects
- Plain text extraction without code blocks
- Complex multi-line text with embedded JSON

### 3. String Field Handling with Complex Quoting

**Core Capability**: Handle string fields with various quoting scenarios and escaped content.

**Key Features**:
- Escaped quotes within string values
- Nested JSON as string content
- Code block content within strings (with escape sequences)
- Unescaped quotes in malformed JSON
- Multi-line string content with preserved formatting
- Empty string handling (with and without quotes)

**Test Coverage**: 8 tests
- Escaped quotes: `{"foo": "["bar"]"}`
- Nested JSON strings: `{"foo": "{"foo": ["bar"]}"}`
- Complex escape sequences with newlines and code blocks
- Mixed quote handling in malformed JSON
- Multi-line strings preserving whitespace and newlines
- Empty string edge cases

### 4. Optional and Nullable Field Support

**Core Capability**: Handle Zod optional and nullable field schemas with proper coercion.

**Key Features**:
- Optional fields that can be omitted from input
- Nullable fields supporting `null` values
- Mixed required/optional field scenarios
- Complex object validation with optional array fields

**Test Coverage**: 6 tests
- Missing optional fields: `z.string().optional()`
- Present optional fields with values
- Nullable fields with explicit `null` values
- Complex schemas mixing required and optional fields
- Multi-field objects with array fields

### 5. Nested Object Structures

**Core Capability**: Parse deeply nested object hierarchies with schema validation.

**Key Features**:
- Simple nested objects
- Nested objects extracted from markdown
- Complex nested structures with arrays of objects
- Array of nested objects
- Multi-level nesting with mixed field types

**Test Coverage**: 6 tests
- Basic nested object: `{"foo": {"a": "hi"}}`
- Nested objects from markdown code blocks
- Complex nested structures with education/skills arrays
- Arrays containing nested objects
- Multi-level object hierarchies

### 6. Field Alias Support

**Core Capability**: Map non-standard field names to schema-expected field names.

**Key Features**:
- Handle field names with dashes, spaces, and punctuation
- Map aliased field names to canonical schema fields
- Support various naming conventions (kebab-case, space-separated, etc.)

**Test Coverage**: 1 test (placeholder implementation)
- Field alias mapping for non-standard keys like `"key-dash"`, `"key with space"`, `"key.with.punctuation/123"`

### 7. Whitespace and Formatting Tolerance

**Core Capability**: Handle malformed JSON with flexible whitespace and formatting rules.

**Key Features**:
- Whitespace in object keys
- Trailing commas with comments
- Mixed quote styles (single/double quotes)
- JavaScript-style comments within objects
- Flexible formatting with extra whitespace

**Test Coverage**: 3 tests
- Keys with whitespace: `{" answer ": {" content ": 78.54}}`
- Trailing commas with comments: `{ diameter: 10, }`
- Complex formatting with comments and extra text

### 8. Union Object Creation

**Core Capability**: Create objects matching union schemas when input doesn't contain expected wrapper.

**Key Features**:
- Automatic union object wrapping
- Schema-based union type selection
- Array processing with union schemas
- Complex union object creation with multiple variants

**Test Coverage**: 1 test
- Function call schema with union types for different parameter sets
- Automatic wrapping in `selected` field for union matching

### 9. Single Value Coercion to Objects

**Core Capability**: Coerce single primitive values into object structures when schema requires it.

**Key Features**:
- Integer to object coercion
- Float to object coercion  
- Boolean to object coercion
- Automatic field assignment for single-field objects

**Test Coverage**: 3 tests
- `"1214"` → `{ foo: 1214 }` for `z.object({ foo: z.number() })`
- `"1214.123"` → `{ foo: 1214.123 }`
- `" true "` → `{ foo: true }`

### 10. Recursive Object Support

**Core Capability**: Handle recursive object structures with lazy schema definitions.

**Key Features**:
- Simple recursive objects with nullable pointers
- Recursive objects with union types
- Mutually recursive object types
- Complex recursive structures with multiple fields
- Recursive parsing with missing bracket recovery
- Multi-level recursive nesting

**Test Coverage**: 8 tests
- Simple recursive: `{ pointer?: RecursiveType | null }`
- Union recursive: `{ pointer: RecursiveType | number }`
- Mutually recursive: `FooType` ↔ `BarType`
- Complex recursive with multiple union fields
- Error recovery for malformed recursive structures
- Deep recursive nesting scenarios

### 11. Streaming and Partial Parsing

**Core Capability**: Handle incomplete JSON structures for streaming scenarios.

**Key Features**:
- Partial object parsing with incomplete data
- Field completion inference for missing data
- Streaming support for large object structures
- Default value assignment for incomplete schemas

**Test Coverage**: 2 tests
- Complete object parsing with all fields present
- Partial parsing with incomplete string values and missing fields

### 12. Complex Real-world Examples

**Core Capability**: Handle production-quality JSON structures with complex nesting and mixed content.

**Key Features**:
- Resume/profile parsing with complex nested arrays
- AI-generated content with code sections and union types
- Mixed content types within single object
- Complex escape sequence handling in real-world data

**Test Coverage**: 2 tests  
- Resume parsing with experience/education/skills arrays
- AI content with code blocks and mixed section types

## Schema Integration Requirements

### Zod Schema Support
- **Object Schemas**: Full support for `z.object()` with nested field definitions
- **Optional Fields**: Proper handling of `z.string().optional()` and similar patterns
- **Nullable Fields**: Support for `z.string().nullable()` with explicit null handling
- **Array Fields**: Complex array schemas including `z.array(z.object(...))`
- **Union Schemas**: Advanced union type resolution with scoring system
- **Recursive Schemas**: Support for `z.lazy()` and circular references

### Type Coercion Rules
- **Primitive Coercion**: String numbers to numbers, string booleans to booleans
- **Array Coercion**: Single values to arrays when schema expects array
- **Object Coercion**: Single values to single-field objects when appropriate
- **Union Resolution**: Intelligent type selection based on data structure compatibility
- **Field Mapping**: Flexible field name matching with alias support

## Error Recovery Capabilities

### Malformed JSON Handling
- **Missing Quotes**: Handle unquoted keys and values
- **Trailing Commas**: Support trailing commas in objects and arrays
- **Missing Brackets**: Recover from incomplete object structures
- **Comment Support**: JavaScript-style comments within JSON
- **Mixed Quotes**: Handle mixing of single and double quotes

### Content Extraction
- **Text Prefix/Suffix**: Extract JSON from natural language text
- **Markdown Code Blocks**: Process ```json code blocks
- **Multiple Objects**: Handle multiple JSON objects in single input
- **Partial Content**: Work with streaming/incomplete JSON data

## Implementation Architecture

### Parser Integration
- **Entry Parser**: Coordinate object parsing through multiple strategies
- **Fixing Parser**: Handle malformed object structures with state machine approach
- **Value System**: Internal representation supporting complex object hierarchies
- **Deserializer**: Schema-aware coercion for object field types

### Object-Specific Coercers
- **Map Coercer**: Handle object field coercion and validation
- **Union Coercer**: Resolve union types for object structures
- **Array Coercer**: Handle arrays of objects and object arrays
- **Primitive Coercers**: Type conversion for object field values

## Success Criteria

### Functional Requirements
- **100% Test Coverage**: All 68 tests in `test/class.test.ts` must pass
- **Schema Compliance**: All parsed objects must validate against provided Zod schemas
- **Error Recovery**: Malformed JSON must be recoverable without exceptions
- **Content Extraction**: JSON objects must be extractable from mixed content

### Performance Requirements
- **Memory Efficiency**: Handle large nested object structures without excessive memory usage
- **Parsing Speed**: Maintain reasonable performance for complex object hierarchies
- **Recursion Safety**: Handle deep recursive structures without stack overflow

### Integration Requirements
- **Zod Integration**: Seamless integration with all Zod object schema types
- **Type Safety**: Full TypeScript type safety for parsed object structures
- **API Consistency**: Consistent behavior with other parser features
- **Error Messages**: Clear validation errors for object schema mismatches

## Related Features

This object parsing capability integrates with and depends on:
- **Basic parsing** (primitives, arrays) - `test/basics.test.ts`
- **Union type resolution** - `test/unions.test.ts`
- **Enum value parsing** - `test/enum.test.ts`
- **Streaming support** - `test/streaming.test.ts`
- **Partial parsing** - `test/partials.test.ts`

The object parsing system serves as the foundation for most complex JSON structures and must maintain compatibility with all other parser features.