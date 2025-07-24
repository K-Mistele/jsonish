# Feature: Basic JSON Parsing

## Overview
This feature encompasses the foundational parsing capabilities of the JSONish parser, providing robust handling of primitive types (strings, numbers, booleans, null), arrays, objects, and mixed content scenarios. It serves as the core layer that all other parsing features build upon, with particular emphasis on error recovery, type coercion, and schema-aware parsing using Zod validation.

## Relationship to Parent Requirements
This feature implements several key sections from `specifications/requirements.md`:

- **Core Parsing Engine** (Section 4.1.1): Multi-strategy parsing approach with error recovery
- **Schema Integration** (Section 4.1.2): Zod schema support and type coercion system
- **Content Extraction** (Section 4.1.3): Mixed content parsing and code block extraction
- **Advanced Features** (Section 4.1.4): String priority logic and multi-object parsing
- **Error Recovery Strategy** (Section 5.2): State machine approach and incremental fixes
- **Type Resolution Logic** (Section 5.3): Schema-first approach with scoring system

## Test-Driven Specifications
Based on test file: `test/basics.test.ts`

### Core Capabilities Tested

#### Primitive Type Parsing
- **String Parsing**: Raw strings, quoted strings, escaped quotes, incomplete strings, mixed content extraction
- **Number Parsing**: Integers, floats, comma-separated numbers (US format), currency formats, fractions, numbers from text
- **Boolean Parsing**: Case variations (true/True/false/False), extraction from text/markdown, ambiguity detection
- **Null Parsing**: Standard null handling and nullable schema support

#### Collection Types
- **Array Parsing**: Integer arrays, type coercion (numbers to strings), trailing commas, incomplete arrays
- **Object Parsing**: Basic objects, nested structures, whitespace handling, unquoted keys/values, multiline values

#### Advanced Parsing Scenarios
- **Markdown Extraction**: JSON from code blocks, multiple block handling, malformed JSON in markdown
- **Mixed Content**: JSON extraction from natural language text with prefixes/suffixes
- **Type Coercion**: Cross-type conversions (number↔string, string↔boolean)
- **Complex Malformed JSON**: Deeply nested structures with multiple parsing errors

### Key Test Scenarios

1. **String Priority Logic**: When targeting string schema, content should be returned as-is rather than attempting JSON parsing
   - Example: `'{"hi": "hello"}'` with string schema → `'{"hi": "hello"}'`

2. **Mixed Content Extraction**: Extracting structured data from text containing JSON
   - Example: `'The output is: {"hello": "world"}'` → extracts the JSON portion

3. **Multi-Object Parsing**: Handling multiple JSON objects in single input
   - Single object: `'{"key": "value1"} {"key": "value2"}'` → first object
   - Array target: same input → `[{key: "value1"}, {key: "value2"}]`

4. **Error Recovery**: Graceful handling of malformed JSON
   - Trailing commas: `'[1, 2, 3,]'` → `[1, 2, 3]`
   - Incomplete structures: `'{"key": [1, 2, 3'` → `{key: [1, 2, 3]}`
   - Unquoted keys/values: `'{key: value with space}'` → `{key: "value with space"}`

5. **Markdown Code Block Extraction**: Finding JSON within markdown formatting
   - Basic: Extract from `\`\`\`json....\`\`\`` blocks
   - Multiple blocks: Select appropriate block based on target schema
   - Malformed: Handle invalid JSON within code blocks

### Edge Cases Covered

- **Incomplete Quoted Strings**: `'"hello'` (missing closing quote)
- **Escaped Quote Handling**: `'"hello \\"world\\""'`
- **Float Edge Cases**: `'12.11.'` (trailing dot), `'$1,234.56'` (currency)
- **Fraction Parsing**: `'1/5'` → `0.2`
- **Boolean Ambiguity**: `'The answer is true or false'` (should throw)
- **Number Extraction**: `'1 cup unsalted butter, room temperature'` → `1.0`
- **Whitespace in Object Keys**: `'{" answer ": {" content ": 78.54}}'`
- **Triple-Quoted Strings**: Python-style `"""multiline strings"""`
- **Complex Malformed Sequences**: Deeply nested objects with structural errors

### Expected Behavior

#### Type Coercion Rules
1. **Schema-First Priority**: Target schema determines parsing approach
2. **String Schema Special Case**: Always return raw input when targeting string
3. **Automatic Type Conversion**: Numbers↔strings, case-insensitive booleans
4. **Array Wrapping**: Single values automatically wrapped in arrays when targeting array schema

#### Error Recovery Strategy
1. **Incremental Fixes**: Add missing commas, close brackets, handle quotes
2. **Graceful Degradation**: Attempt multiple parsing strategies before failing
3. **Context Preservation**: Maintain structure even with parsing errors
4. **Validation Integration**: Final validation against Zod schema

#### Multi-Content Handling
1. **First Match Priority**: Return first valid structure when multiple candidates exist
2. **Schema-Guided Selection**: Choose structure that best matches target schema
3. **Text Extraction**: Strip surrounding text while preserving JSON structure

## Implementation Requirements

### Parser Architecture
- **Entry Point**: Coordinate between standard JSON parser, fixing parser, and multi-object parser
- **Fixing Parser**: State machine implementation for error recovery
- **Value System**: Internal representation matching Rust Value enum
- **Multi-Strategy Parsing**: Fallback from strict to permissive approaches

### Type System Integration
- **Zod Schema Support**: Accept any Zod schema for type coercion
- **Coercer Implementation**: Primitive, array, literal, and object coercers
- **Scoring System**: Quantitative type matching for union resolution
- **Validation Pipeline**: Integrated validation with clear error messages

### Content Processing
- **Text Analysis**: Pattern recognition for JSON-like structures
- **Markdown Processing**: Code block extraction and content parsing
- **String Handling**: Proper quote escaping and multiline support
- **Whitespace Management**: Flexible whitespace handling in objects/arrays

## Success Criteria

### Immediate Goals (Current Regression)
- All tests in `basics.test.ts` pass (currently 62/67 passing - regression)
- String priority logic correctly implemented (1 test failure)
- Multi-object parsing properly handles array vs single object targets (2 test failures)
- Complex parsing scenarios with malformed JSON work correctly (2 test failures)

### Quality Standards
- 100% test coverage for all primitive types and basic collections
- Robust error recovery that never throws uncaught exceptions
- Type coercion that maintains data integrity while maximizing compatibility
- Performance comparable to standard JSON.parse for valid JSON inputs

### Behavioral Requirements
- Exact parity with Rust implementation behavior for all test cases
- Schema-aware parsing that respects Zod validation rules
- Intelligent content extraction from mixed text/markdown inputs
- Graceful handling of all documented edge cases and malformed JSON scenarios