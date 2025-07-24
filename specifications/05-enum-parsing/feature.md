# Feature: Enum Value Parsing and Validation

## Overview
This feature encompasses the comprehensive enum parsing capabilities of the JSONish parser, providing intelligent enum value extraction, case-insensitive matching, alias resolution, and robust error handling. It enables parsing enum values from various input formats including quoted strings, arrays, mixed text content, and supports advanced alias systems for flexible enum matching while maintaining strict validation and error detection for ambiguous cases.

## Relationship to Parent Requirements
This feature implements several key sections from `specifications/requirements.md`:

- **Schema Integration** (Section 4.1.2): Zod enum schema support and type coercion system
- **Type Coercion System**: Intelligent conversion of string inputs to match enum schema values
- **Content Extraction** (Section 4.1.3): Enum extraction from mixed content and markdown
- **Advanced Features** (Section 4.1.4): Complex enum resolution with alias support
- **Type Resolution Logic** (Section 5.3): Schema-first approach with scoring system for enum disambiguation
- **Error Handling & Reliability** (Section 4.2.2): Graceful handling of ambiguous enum matches

## Test-Driven Specifications
Based on test file: `test/enum.test.ts`

### Core Capabilities Tested

#### Basic Enum Parsing
- **Exact Matching**: Direct enum value parsing with exact string matches
- **Case-Insensitive Matching**: Converting lowercase/mixed case input to proper enum values
- **Quoted Value Handling**: Parsing enum values from quoted strings
- **Array Extraction**: Extracting enum values from single-item and multi-item arrays
- **First Value Priority**: Taking first valid enum from multi-item arrays

#### Enum from Mixed Content
- **Description Extraction**: Parsing enums with descriptive text suffixes (e.g., "ONE: description")
- **Text Embedding**: Finding enum values within natural language text
- **Markdown Formatting**: Extracting enums from markdown-formatted text (bold, italic)
- **Case Conversion**: Handling PascalCase enums with uppercase input
- **Punctuation Separation**: Extracting enums with various punctuation separators (dash, colon, period)
- **Quoted Text Processing**: Finding enums within quoted text passages

#### Advanced Alias System
- **Simple Aliases**: Mapping shorthand codes to enum values (e.g., "k1" → "ONE")
- **Complex Aliases**: Handling multi-character aliases with special characters (e.g., "k-2-3.1_1" → "TWO")
- **Spaced Aliases**: Processing aliases with spaces (e.g., "NUMBER THREE" → "THREE")
- **Alias with Descriptions**: Extracting aliases followed by descriptive text
- **Multiple Alias Resolution**: Scoring multiple aliases to determine best match
- **Alias Frequency Scoring**: Weighing repeated aliases to select winner

#### Error Detection and Validation
- **Ambiguous Match Detection**: Identifying and rejecting case-insensitive ambiguous matches
- **Multiple Enum Prevention**: Detecting and rejecting input with multiple enum values
- **Punctuation Conflict Handling**: Rejecting input with multiple enums separated by punctuation
- **Tie Resolution Failure**: Properly failing when multiple aliases have equal scores

### Key Test Scenarios

1. **Basic Enum Value Parsing**
   - Direct match: `"TWO"` with enum `["ONE", "TWO"]` → `"TWO"`
   - Case-insensitive: `"two"` with enum `["ONE", "TWO"]` → `"TWO"`
   - Quoted input: `'"TWO"'` → `"TWO"`

2. **Array-Based Enum Extraction**
   - Single-item array: `'["TWO"]'` → `"TWO"`
   - Multi-item array: `'["TWO", "THREE"]'` → `"TWO"` (first valid)

3. **Text-Embedded Enum Extraction**
   - With description: `'"ONE: The description of k1"'` → `"ONE"`
   - In sentence: `"The answer is One"` → `"ONE"`
   - Markdown formatting: `"**one** is the answer"` → `"ONE"`
   - PascalCase handling: `"**ONE**"` with `["One", "Two"]` → `"One"`

4. **Alias Resolution System**
   - Simple alias: `"k1"` → `"ONE"`
   - Complex alias: `"k-2-3.1_1"` → `"TWO"`
   - Spaced alias: `"NUMBER THREE"` → `"THREE"`
   - Multiple aliases with frequency: Winner determined by repetition count

5. **Error Cases and Validation**
   - Ambiguous case match: `'"Two"'` should throw when both "TWO" and "Two" possible
   - Multiple enums: `'"ONE - is the answer, not TWO"'` should throw
   - Alias ties: Equal frequency aliases should throw

6. **Complex Content Scenarios**
   - Numerical enums with null fallback: Proper optional handling
   - Special character handling in content with mathematical symbols
   - Long streaming context with embedded enum values

### Edge Cases Covered

- **Numerical Enum Values**: Handling enum values that are numeric strings ("9325", "1040-X")
- **Optional Enum Schemas**: Returning undefined for z.enum().optional() when no match found
- **Substring Ambiguity**: Rejecting inputs where enum values could be substrings
- **Special Character Content**: Processing enums from text with mathematical notation and special symbols
- **Long Context Processing**: Extracting enums from extensive descriptive text
- **Alias Normalization**: Handling aliases with modified punctuation and spacing
- **Array of Enums with Aliases**: Processing arrays containing alias values

### Expected Behavior

#### Enum Matching Rules
1. **Exact Match Priority**: Direct enum value matches take precedence
2. **Case-Insensitive Fallback**: Convert input case to match enum case
3. **Alias Resolution**: Apply alias mapping when direct match fails
4. **First Valid Selection**: Take first valid enum from arrays/multiple candidates

#### Text Extraction Strategy
1. **Pattern Recognition**: Identify enum-like patterns in text
2. **Context Separation**: Extract enum from surrounding descriptive text
3. **Punctuation Handling**: Properly separate enums from punctuation markers
4. **Markdown Processing**: Handle markdown formatting around enum values

#### Error Handling Approach
1. **Ambiguity Detection**: Identify and reject ambiguous matches
2. **Multi-Value Prevention**: Detect multiple enum values in single input
3. **Clear Error Messages**: Provide actionable feedback for validation failures
4. **Graceful Degradation**: Return undefined for optional schemas when appropriate

#### Alias System Logic
1. **Mapping Definition**: Define clear alias-to-enum mappings
2. **Frequency Scoring**: Count alias occurrences to resolve conflicts
3. **Tie Breaking**: Fail explicitly when aliases have equal scores
4. **Context Preservation**: Maintain alias context within larger text

## Implementation Requirements

### Alias Resolution Engine
- **Pattern Matching**: Recognize alias patterns within text content
- **Frequency Analysis**: Track and score multiple alias occurrences
- **Conflict Resolution**: Determine winning alias based on context and frequency
- **Normalization**: Handle alias variations with different punctuation/spacing

### Content Processing Pipeline
- **Text Analysis**: Extract potential enum values from mixed content
- **Context Recognition**: Identify enum values within descriptive text
- **Markdown Parsing**: Handle formatted text containing enum values
- **Punctuation Processing**: Separate enums from surrounding punctuation

### Validation and Error System
- **Ambiguity Detection**: Identify cases where multiple interpretations possible
- **Multi-Value Detection**: Prevent selection when multiple enums present
- **Schema Integration**: Validate final enum values against Zod schemas
- **Error Messaging**: Provide clear feedback for validation failures

### Type Coercion Integration
- **Case Normalization**: Convert input case to match schema enum case
- **Array Unwrapping**: Extract single enum values from array inputs
- **Optional Handling**: Support optional enum schemas with undefined fallback
- **Union Support**: Work within union type resolution system

## Success Criteria

### Core Functionality
- All tests in `enum.test.ts` pass (340 total enum-related test cases)
- Exact enum value matching works reliably
- Case-insensitive matching with proper case conversion
- Array-based enum extraction with first-valid priority

### Alias System Performance
- Complex alias patterns resolved correctly
- Frequency-based conflict resolution working
- Tie detection and proper error throwing
- Context-aware alias extraction from text

### Error Detection Quality
- Ambiguous match detection prevents incorrect results
- Multi-value scenarios properly rejected
- Clear error messages for debugging
- Graceful handling of edge cases

### Integration Standards
- Seamless integration with Zod enum schemas
- Proper handling of optional enum types
- Support for enum arrays and complex structures
- Performance comparable to other coercer implementations

### Behavioral Requirements
- Exact parity with Rust implementation behavior for all test cases
- Schema-aware enum parsing that respects Zod validation rules
- Intelligent content extraction from mixed text/markdown inputs
- Robust alias resolution system with proper conflict handling