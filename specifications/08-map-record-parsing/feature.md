# Feature: Map/Record Parsing

## Overview
This feature encompasses the JSONish parser's capability to handle dynamic key-value structures through Zod record schemas (`z.record()`). Unlike static object parsing with predefined properties, map/record parsing supports arbitrary string keys with type-validated values, enabling flexible data structures like configurations, metadata, and dynamic collections. The feature includes comprehensive key handling (including special characters, whitespace, and type coercion), value type validation, nested map structures, and robust error recovery for malformed map data.

## Relationship to Parent Requirements
This feature implements several key sections from `specifications/requirements.md`:

- **Schema Integration** (Section 4.1.2): Zod record schema support and type coercion for dynamic key-value structures
- **Type Coercion System** (Section 4.1.2): Map coercer implementation for flexible key-value parsing
- **Content Extraction** (Section 4.1.3): Map extraction from mixed content and markdown code blocks
- **Advanced Features** (Section 4.1.4): Recursive parsing for nested map structures
- **Error Recovery Strategy** (Section 5.2): Graceful handling of malformed map structures
- **Type Resolution Logic** (Section 5.3): Union type resolution within map values

## Test-Driven Specifications
Based on test file: `test/maps.test.ts`

### Core Capabilities Tested

#### Basic Map Operations
- **Simple String Maps**: Key-value pairs with string values (`z.record(z.string())`)
- **Typed Value Maps**: Maps with number, boolean, and other primitive value types
- **Empty Map Handling**: Proper parsing of empty object literals (`{}`)
- **Escaped Quote Support**: Keys and values containing escaped quotes (`""a"": ""b""`)

#### Dynamic Key Support
- **Special Character Keys**: Keys with dots, dashes, underscores (`"key.with.dots"`, `"key-with-dashes"`)
- **Whitespace in Keys**: Keys containing spaces and leading/trailing whitespace
- **Newline Handling**: Keys containing newline characters (multiline keys)
- **Numeric-like Keys**: String keys that look like numbers (`"123"`, `"456"`)
- **Key Type Coercion**: Automatic conversion of non-string keys to strings (`5: "b"` → `"5": "b"`)

#### Enum and Literal Key Support
- **Enum Keys**: Maps with enum-constrained keys (`z.record(z.enum(["A", "B"]), z.string())`)
- **Literal Union Keys**: Keys constrained to specific literal values (`z.union([z.literal("A"), z.literal("B")])`)
- **Key Validation**: Proper validation and coercion of keys to match schema constraints

#### Complex Value Types
- **Object Values**: Maps containing nested objects with defined schemas
- **Array Values**: Maps with array values (`z.record(z.array(z.string()))`)
- **Union Values**: Maps supporting multiple value types (`z.record(z.union([z.string(), z.number()]))`)
- **Optional Values**: Maps with optional value types (`z.record(z.string().optional())`)
- **Class Object Values**: Maps containing structured objects with multiple properties

#### Nested Map Structures
- **Map of Maps**: Nested record structures (`z.record(z.record(z.string()))`)
- **Maps with Object Properties**: Objects containing map properties as nested fields
- **Complex Nesting**: Multi-level nesting with maps, objects, and arrays combined
- **Array of Maps**: Maps contained within array structures

#### Union Type Integration
- **Map vs Object Unions**: Resolving between map schemas and object schemas in unions
- **Priority Resolution**: Proper handling when input could match multiple union types
- **Type Scoring**: Scoring system for selecting best matching type in ambiguous cases

#### Map Validation and Constraints
- **Value Constraints**: String length constraints, number ranges, enum validation
- **Schema Validation**: Full Zod validation integration for map values
- **Type Safety**: Proper TypeScript type inference for map structures

### Key Test Scenarios

1. **Basic Map Parsing**: Standard key-value parsing with various value types
   - String values: `{"key1": "value1", "key2": "value2"}`
   - Number values: `{"count": 42, "total": 100}`
   - Boolean values: `{"enabled": true, "visible": false}`

2. **Dynamic Key Handling**: Support for arbitrary key formats
   - Special characters: `{"key.with.dots": "value1", "key-with-dashes": "value2"}`
   - Whitespace: `{"key with spaces": "value1", " leading space": "value2"}`
   - Type coercion: `{5: "b", 2.17: "e", null: "n"}` → `{"5": "b", "2.17": "e", "null": "n"}`

3. **Enum Key Constraints**: Maps with restricted key sets
   - Enum keys: `z.record(z.enum(["A", "B"]), z.string())` with `{"A": "one", "B": "two"}`
   - Literal unions: Keys restricted to specific literal values

4. **Complex Value Types**: Maps with structured value types
   - Object values: `{"person1": {"name": "Alice", "age": 30}}`
   - Array values: `{"fruits": ["apple", "banana"], "vegetables": ["carrot"]}`
   - Union values: Mixed string/number values in same map

5. **Nested Map Structures**: Multi-level map hierarchies
   - Map of maps: `{"level1": {"level2a": "value1", "level2b": "value2"}}`
   - Complex nesting: Maps containing objects with map properties

6. **Union Type Resolution**: Distinguishing maps from objects in union schemas
   - Map vs object: `z.union([z.record(z.string()), z.object({a:z.string(), b:z.string()})])`
   - Priority rules: How parser chooses between matching schemas

### Error Recovery and Edge Cases

#### Malformed Map Handling
- **Trailing Commas**: `{"key": "value",}` (extra comma handling)
- **Incomplete Maps**: `{"key": "value"` (missing closing brace)
- **Unterminated Values**: `{"a": "b\n` (unclosed string values)
- **Nested Incomplete Maps**: Partial parsing of nested structures

#### Mixed Content Extraction
- **Text Prefixes**: `'The configuration is: {"debug": "true", "mode": "production"}'`
- **Markdown Code Blocks**: Maps extracted from ```json``` blocks
- **Multiple Maps**: Handling multiple map structures in single input (first match priority)
- **Extra Text Handling**: Maps with trailing text that should be ignored

#### Graceful Degradation
- **Empty Input**: Proper handling of empty strings
- **Invalid JSON**: Graceful failure for completely invalid input
- **Type Validation Errors**: Clear error messages for schema validation failures

### Expected Behavior

#### Key Processing Rules
1. **String Coercion**: All keys automatically converted to strings regardless of input type
2. **Whitespace Preservation**: Keys maintain their exact whitespace as provided
3. **Special Character Support**: No restrictions on key content (dots, dashes, spaces, newlines)
4. **Unicode Support**: Full Unicode support in key names

#### Value Type Coercion
1. **Schema-Driven Coercion**: Values coerced to match the specified value schema
2. **Type Validation**: Full Zod validation applied to each value
3. **Union Resolution**: Best-match selection for union value types
4. **Optional Handling**: Proper null/undefined handling for optional values

#### Map vs Object Resolution
1. **Schema Priority**: Parser chooses based on provided schema type
2. **Union Scoring**: Quantitative scoring for ambiguous cases
3. **Structural Analysis**: Consider key patterns and value types for resolution
4. **Fallback Logic**: Graceful fallback when primary match fails

## Implementation Requirements

### Map Coercer Architecture
- **Key Processing**: Unified key coercion to string type with special character support
- **Value Coercion**: Integration with existing coercer system for value type handling
- **Schema Integration**: Full Zod record schema support with key/value validation
- **Nested Support**: Recursive map parsing for nested structures

### Type System Integration
- **Record Schema Support**: Complete `z.record()` implementation with optional key constraints
- **Enum Key Support**: `z.record(z.enum(...), valueSchema)` for constrained keys
- **Value Type Flexibility**: Support for any Zod schema as value type
- **Union Integration**: Proper scoring and resolution in union contexts

### Error Recovery System
- **Malformed Map Recovery**: State machine approach for fixing incomplete maps
- **Key-Value Pair Recovery**: Intelligent handling of malformed key-value syntax
- **Nested Error Handling**: Graceful recovery in deeply nested map structures
- **Content Extraction**: Robust extraction from mixed content scenarios

### Performance Considerations
- **Dynamic Key Efficiency**: Efficient processing of arbitrary key sets
- **Memory Management**: Proper handling of large maps without excessive memory usage
- **Validation Performance**: Fast validation of map structures against schemas
- **Nested Structure Performance**: Efficient processing of deeply nested maps

## Success Criteria

### Functional Requirements
- All tests in `maps.test.ts` pass (65 test scenarios across 13 test groups)
- Proper handling of all dynamic key formats and special characters
- Complete value type coercion and validation for all supported Zod schemas
- Robust error recovery for malformed map structures

### Quality Standards
- 100% test coverage for map/record parsing scenarios
- Efficient performance for large maps and deeply nested structures
- Memory-safe processing without leaks or excessive allocation
- Clear error messages for validation failures and parsing errors

### Behavioral Requirements
- Exact parity with Rust implementation behavior for all map test cases
- Consistent key coercion and value type handling across all scenarios
- Proper union type resolution when maps compete with other schema types
- Graceful handling of edge cases including malformed JSON and mixed content

### Integration Standards
- Seamless integration with existing coercer system and scoring algorithms
- Proper TypeScript type inference for map structures
- Compatible with all existing parser features (streaming, multi-object, etc.)
- Maintains architectural consistency with other parsing features