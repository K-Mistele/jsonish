# Feature: Array and List Parsing

## Overview
This feature provides comprehensive array and list parsing capabilities within the JSONish parser, handling both well-formed and malformed array structures, intelligent type coercion for array elements, nested array scenarios, single value to array conversion, and robust validation. It serves as a critical component for structured data parsing with emphasis on flexibility, error recovery, and schema-aware type coercion using Zod validation.

## Relationship to Parent Requirements
This feature implements several key sections from `specifications/requirements.md`:

- **Core Parsing Engine** (Section 4.1.1): Multi-strategy parser with array-specific error recovery mechanisms
- **Schema Integration** (Section 4.1.2): Array-aware type coercion system with element-level validation
- **Content Extraction** (Section 4.1.3): Array extraction from mixed content and markdown code blocks
- **Advanced Features** (Section 4.1.4): Single value wrapping and recursive nested array parsing
- **Error Recovery Strategy** (Section 5.2): Incremental fixes for malformed array structures
- **Type Resolution Logic** (Section 5.3): Array element type resolution with union support

## Test-Driven Specifications
Based on test file: `test/lists.test.ts`

### Core Capabilities Tested

#### Basic Array Parsing
- **Primitive Arrays**: Integer arrays, string arrays, boolean arrays, empty arrays
- **Standard JSON Format**: Well-formed JSON arrays with proper brackets and commas
- **Type Consistency**: Arrays with consistent element types matching schema expectations
- **Empty Array Handling**: Proper parsing and validation of empty array literals `[]`

#### Array Type Coercion
- **Cross-Type Element Conversion**: Numbers to strings, strings to numbers, mixed type arrays
- **Flexible Type Casting**: Automatic element coercion to match target array schema
- **Mixed Element Types**: Arrays containing different primitive types with intelligent coercion
- **Float Handling**: Integer and float numbers within arrays with proper precision

#### Single Value to Array Coercion
- **Automatic Wrapping**: Single strings, numbers, booleans wrapped in arrays when targeting array schema
- **Content Extraction**: Boolean and other values extracted from text and wrapped in arrays
- **Schema-Driven Conversion**: Single value conversion based on target array element type
- **Text Processing**: Value extraction from natural language text into single-element arrays

#### Nested Array Structures
- **Multi-Dimensional Arrays**: 2D and 3D array parsing with proper nesting
- **Recursive Structure Handling**: Deeply nested arrays with consistent type validation
- **Mixed Nesting Levels**: Arrays with varying levels of nesting within same structure
- **Complex Nested Types**: Arrays of arrays containing different primitive types

### Advanced Array Scenarios

#### Malformed Array Recovery
- **Trailing Comma Handling**: Arrays with trailing commas parsed correctly
- **Unquoted String Elements**: Array elements without proper quotes automatically corrected
- **Mixed Quote Styles**: Arrays with mixed single quotes, double quotes, and unquoted elements
- **Incomplete Array Structures**: Partial arrays missing closing brackets or commas

#### Streaming and Partial Arrays
- **Incomplete Array Parsing**: Arrays missing closing brackets parsed as far as possible
- **Single Element Incomplete**: Arrays with single elements but incomplete structure
- **Progressive Parsing**: Streaming JSON arrays processed incrementally
- **Error Recovery**: Graceful handling of cut-off array data

#### Complex Object Arrays
- **Object Element Arrays**: Arrays containing complex objects with multiple properties
- **Transaction Record Arrays**: Real-world data structures like financial transactions
- **Mixed Object Types**: Arrays containing objects with different but compatible schemas
- **Nested Object Properties**: Objects within arrays containing nested structures

#### Union Type Arrays
- **Mixed Type Elements**: Arrays with union types allowing multiple element types
- **Object Union Arrays**: Arrays containing objects with discriminated union types
- **Type Resolution**: Intelligent selection of best matching type for array elements
- **Schema Validation**: Proper validation of union array elements against schemas

### Content Extraction Scenarios

#### Array Extraction from Mixed Content
- **Text Prefix/Suffix**: Arrays embedded in natural language text with surrounding content
- **Markdown Code Blocks**: JSON arrays within markdown code fence blocks
- **Multiple Array Detection**: Handling multiple arrays in text (selecting first valid match)
- **Pattern Recognition**: Identifying array-like structures in various text formats

#### Special Format Handling
- **Quoted Array Elements**: Arrays with escaped quotes within string elements
- **Extra Text Context**: Arrays followed by explanatory text or additional content
- **Unquoted Array Extraction**: Arrays with unquoted elements extracted from mixed content
- **Code Block Extraction**: Arrays within markdown JSON code blocks properly parsed

### Key Test Scenarios

1. **Basic Array Types**: Standard parsing of arrays containing consistent element types
   - Numbers: `[1, 2, 3]` → `[1, 2, 3]`
   - Strings: `["hello", "world", "test"]` → `["hello", "world", "test"]`
   - Booleans: `[true, false, true]` → `[true, false, true]`

2. **Type Coercion in Arrays**: Element-level type conversion to match target schema
   - Numbers to strings: `[1, 2, 3]` with string array schema → `["1", "2", "3"]`
   - Strings to numbers: `["1", "2", "3"]` with number array schema → `[1, 2, 3]`
   - Mixed types: `[1, 2.5, "3"]` with number array schema → `[1, 2.5, 3]`

3. **Single Value Wrapping**: Automatic array wrapping for single values
   - String: `"hello"` with string array schema → `["hello"]`
   - Number: `42` with number array schema → `[42]`
   - Boolean from text: `"The answer is true"` with boolean array schema → `[true]`

4. **Nested Array Parsing**: Multi-dimensional array structures
   - 2D arrays: `[[1, 2], [3, 4], [5, 6]]` → proper nested structure
   - 3D arrays: `[[[1]], [[2, 3]], [[4, 5, 6]]]` → deeply nested arrays
   - Mixed nesting: Arrays with varying levels of depth

5. **Malformed Array Recovery**: Error correction for common array format issues
   - Trailing comma: `[1, 2, 3,]` → `[1, 2, 3]`
   - Unquoted strings: `[hello, world, test]` → `["hello", "world", "test"]`
   - Mixed quotes: `["hello", 'world', test]` → `["hello", "world", "test"]`

6. **Complex Object Arrays**: Arrays containing structured objects
   - Simple objects: `[{"a": 1, "b": "hello"}, {"a": 2, "b": "world"}]`
   - Transaction records: Arrays of financial transaction objects with multiple fields
   - Union objects: Arrays with discriminated union object types

7. **Streaming Array Parsing**: Partial array structures from incomplete input
   - Incomplete arrays: `[1234, 5678` → `[1234, 5678]`
   - Single element: `[1234` → `[1234]`
   - Cut-off data: Graceful handling of truncated array content

8. **Content Extraction**: Arrays from mixed text and markdown
   - Text embedding: `"Here are the numbers: [1, 2, 3]"` → `[1, 2, 3]`
   - Code blocks: Arrays within markdown JSON code fence blocks
   - Multiple arrays: First valid array selected from text with multiple candidates

### Edge Cases Covered

- **Escaped Quotes in Arrays**: `[""a"", ""b""]` → `['"a"', '"b"']`
- **Empty Array Variations**: Different empty array representations
- **Whitespace Tolerance**: Arrays with irregular spacing and line breaks
- **Large Arrays**: Performance with arrays containing many elements
- **Deep Nesting**: Arrays nested to significant depths without stack overflow
- **Unicode Content**: Array elements containing unicode characters
- **Special Characters**: Array elements with special JSON characters requiring escaping
- **Mixed Content Arrays**: Arrays extracted from text with various prefix/suffix patterns

### Expected Behavior

#### Array Type Coercion Rules
1. **Element-Level Coercion**: Each array element coerced individually to match target element type
2. **Schema Consistency**: All elements in array must conform to specified element schema
3. **Single Value Wrapping**: Non-array values automatically wrapped when targeting array schema
4. **Type Priority**: Element type determined by array element schema specification

#### Array Error Recovery Strategy
1. **Structural Repair**: Missing brackets, commas, and quotes added automatically
2. **Element Validation**: Individual elements validated and coerced independently
3. **Partial Completion**: Incomplete arrays processed up to available content
4. **Graceful Degradation**: Progressive parsing strategies from strict to permissive

#### Nested Array Handling
1. **Recursive Processing**: Nested arrays processed recursively with proper depth tracking
2. **Type Consistency**: Nested array element types maintained throughout structure
3. **Memory Management**: Efficient parsing of deeply nested structures
4. **Error Propagation**: Nested parsing errors handled gracefully without breaking parent structure

## Implementation Requirements

### Array Parser Architecture
- **Array Detection**: Recognize array patterns in various formats (bracketed, unquoted, mixed)
- **Element Parsing**: Individual element parsing with type-specific handling
- **Structure Validation**: Bracket matching and comma placement validation
- **Recovery Mechanisms**: Automatic correction of common array formatting errors

### Type System Integration
- **Array Schema Support**: Full support for Zod array schemas with element type specifications
- **Element Coercion**: Individual array element coercion using existing coercer system
- **Union Array Handling**: Support for arrays with union element types
- **Validation Pipeline**: Array-level and element-level validation with clear error reporting

### Content Processing
- **Array Extraction**: Pattern recognition for array structures in mixed content
- **Markdown Processing**: Array extraction from code blocks and formatted text
- **Streaming Support**: Progressive array parsing for incomplete or streaming data
- **Memory Efficiency**: Optimized processing for large arrays without excessive memory usage

### Error Handling
- **Structural Errors**: Recovery from missing brackets, commas, and quotes
- **Element Errors**: Individual element error handling without array failure
- **Partial Arrays**: Graceful handling of incomplete array structures
- **Validation Errors**: Clear error messages for schema validation failures

## Success Criteria

### Core Array Functionality
- All tests in `lists.test.ts` pass (comprehensive array parsing scenarios)
- Basic array parsing for all primitive types (string, number, boolean)
- Empty array handling and validation
- Proper type coercion for array elements

### Advanced Array Features
- Single value to array conversion works correctly for all types
- Nested array parsing handles multi-dimensional structures
- Malformed array recovery fixes common formatting issues
- Union type arrays resolve element types correctly

### Content Extraction
- Arrays extracted correctly from mixed text content
- Markdown code block array extraction works properly
- Multiple array scenarios handle first-match selection
- Complex object arrays parse with proper schema validation

### Error Recovery and Streaming
- Streaming/partial array parsing handles incomplete structures
- Malformed arrays recover gracefully with structural repairs
- Error messages provide clear guidance for validation failures
- Performance remains acceptable for large arrays and deep nesting

### Quality Standards
- 100% test coverage for array parsing scenarios (66 test cases)
- Robust error recovery that never throws uncaught exceptions
- Type coercion maintains data integrity while maximizing flexibility
- Performance comparable to standard JSON.parse for well-formed arrays
- Exact behavioral parity with Rust implementation for all test cases