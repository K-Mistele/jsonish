# Feature: Literal Value Parsing

## Overview
This feature provides comprehensive parsing and validation of literal values using Zod literal schemas. It handles exact matching of string, number, and boolean literals with intelligent case coercion, text extraction capabilities, and union resolution. The literal parsing system is designed to find and extract specific expected values from various input formats including raw JSON, mixed text content, and structured objects.

## Relationship to Parent Requirements
This feature implements several key sections from `specifications/requirements.md`:

- **Schema Integration** (Section 4.1.2): Zod literal schema support with exact value matching and validation
- **Type Coercion System** (Section 4.1.2): Intelligent case coercion for string literals and type-specific conversions  
- **Content Extraction** (Section 4.1.3): Extraction of literal values from mixed content and text
- **Union Type Resolution** (Section 4.1.4): Scoring system for resolving ambiguous literal matches in unions
- **Type Resolution Logic** (Section 5.3): Schema-first approach with priority rules for literal matching
- **Validation Integration** (Section 5.3): Tight integration between parsing and Zod literal validation

## Test-Driven Specifications
Based on test file: `test/literals.test.ts`

### Core Capabilities Tested

#### Basic Literal Value Types
- **Integer Literals**: Positive integers (`2`), negative integers (`-42`), zero (`0`)
- **Boolean Literals**: True/false boolean values with exact matching
- **String Literals**: Exact string matching with case sensitivity and coercion support

#### String Literal Processing with Case Coercion
- **Quoted String Handling**: Double-quoted strings (`"TWO"`) with proper quote removal
- **Unquoted String Parsing**: Raw string values without quotes (`TWO`)  
- **Case Coercion**: Automatic case conversion to match expected literal
  - Mixed case: `"Two"` → `"TWO"`
  - Lowercase: `"two"` → `"TWO"`
  - Uppercase preservation when expected

#### Text Extraction and Content Mining
- **Prefix Text Extraction**: Find literals in text with preceding content
  - `"The answer is TWO"` → extracts `"TWO"`
- **Suffix Text Extraction**: Find literals in text with following content  
  - `"TWO is the answer"` → extracts `"TWO"`
- **Mixed Case in Text**: Case coercion during text extraction
  - `"The answer is Two"` → extracts and coerces to `"TWO"`

#### Quote Position and Context Handling
- **Quoted Literals in Text**: Extract quoted literals from mixed content
  - `'The answer is "TWO"'` → extracts `"TWO"`
  - `'The answer is "two"'` → extracts and coerces to `"TWO"`
- **Quote Position Variations**: Handle quotes at beginning or end of text
  - `'"TWO" is the answer'` → extracts `"TWO"`
  - `'"Two" is the answer'` → extracts and coerces to `"TWO"`

#### Special Case Processing
- **Bidirectional Case Coercion**: Handle case mismatches in both directions
  - Expected lowercase from uppercase text: `"TWO"` → `"two"`
- **Special Character Handling**: Extract literals while ignoring extra characters
  - `'"TWO!@#"'` → extracts `"TWO"` (ignoring special chars)
- **Whitespace Trimming**: Remove surrounding whitespace from literals
  - `'"  TWO  "'` → extracts `"TWO"` (trimmed)

### Union Literal Resolution

#### Basic Union Matching
- **Integer Union Literals**: Match specific numbers from union options
  - Schema: `z.union([z.literal(2), z.literal(3)])`
  - Input: `"2"` → `2`

#### Ambiguity Detection and Handling  
- **Multiple Match Failure**: Detect when input contains multiple union options
  - Input: `"2 or 3"` → should throw (ambiguous)
  - Input: `"true or false"` → should throw (ambiguous)
- **First Match Priority**: For string unions, select first matching option
  - Schema: `z.union([z.literal("TWO"), z.literal("THREE")])`
  - Input: `"TWO or THREE"` → `"TWO"` (first match wins)

### Object Single Value Extraction

#### Simple Object Value Extraction
- **Single Key Objects**: Extract literal values from objects with one key-value pair
  - Input: `{"status": 1}` with literal union → `1`
  - Input: `{"result": true}` with literal union → `true`  
  - Input: `{"value": "THREE"}` with literal union → `"THREE"`

#### Object Validation Rules
- **Multi-Key Rejection**: Objects with multiple keys should fail literal extraction
  - Input: `{"status": 1, "message": "success"}` → should throw
- **Nested Object Rejection**: Objects with nested structures should fail
  - Input: `{"status": {"code": 1}}` → should throw
- **Array Content Rejection**: Objects containing arrays should fail
  - Input: `{"values": [1]}` → should throw

### Edge Cases and Advanced Scenarios

#### String Ambiguity Resolution
- **Complete vs Partial Match**: Prefer complete string matches over substrings
  - Schema: `z.union([z.literal("pay"), z.literal("pay_without_credit_card")])`
  - Input: `"pay"` → `"pay"` (exact match preferred)
- **Streaming Failure Detection**: Handle incomplete streaming input appropriately
  - Input: `"pay` (incomplete) → should throw (streaming failure)

#### Quote and Text Integration
- **Escaped Quote Handling**: Process escaped quotes within object values
  - Input: `{"value": "\\"THREE\\""}` → extracts `"THREE"`
- **Text Extraction from Objects**: Find literals within text values in objects
  - Input: `{"value": "The answer is THREE"}` → extracts `"THREE"`

#### Partial Object Support
- **Optional Nullable Literals**: Handle optional literal fields with null defaults
  - Schema: `z.object({bar: z.literal("hello").optional().nullable()})`
  - Input: `"{}"` → `{bar: null}`

### Expected Behavior

#### Literal Matching Rules
1. **Exact Value Priority**: Prefer exact matches over coerced matches
2. **Case Insensitive Coercion**: Automatically adjust case to match expected literal
3. **Text Extraction**: Find target literal within larger text content
4. **Quote Handling**: Process both quoted and unquoted literal values
5. **Type Preservation**: Maintain original type (string/number/boolean) during matching

#### Union Resolution Strategy
1. **Ambiguity Detection**: Fail when multiple literal options are present in input
2. **First Match Selection**: For string literals, select first valid match
3. **Type-Specific Behavior**: Different resolution strategies for strings vs numbers/booleans
4. **Context-Aware Scoring**: Use scoring system for complex union scenarios

#### Object Value Extraction Rules
1. **Single Value Only**: Only extract from objects with exactly one key-value pair
2. **Type Matching**: Extracted value must match one of the literal union options
3. **Structural Validation**: Reject nested objects, arrays, or multi-key objects
4. **Quote Processing**: Handle quoted values and text extraction within object values

#### Error Handling and Validation
1. **Schema Validation**: Final validation against Zod literal schema
2. **Ambiguity Errors**: Clear error messages for ambiguous input
3. **Structural Errors**: Appropriate failures for invalid object structures
4. **Streaming Errors**: Proper handling of incomplete input data

## Implementation Requirements

### Literal Coercer Architecture
- **Literal-Specific Logic**: Dedicated coercer in `src/deserializer/coercer/literal_coercer.ts`
- **Case Coercion Engine**: Intelligent case conversion for string literals
- **Text Mining**: Pattern matching for literal extraction from mixed content
- **Validation Integration**: Direct integration with Zod literal schema validation

### Union Resolution System
- **Scoring Integration**: Use existing scoring system for literal union resolution
- **Ambiguity Detection**: Implement logic to detect and handle ambiguous scenarios  
- **Priority Rules**: Clear priority ordering for literal matching strategies
- **Type-Aware Processing**: Different handling strategies for different literal types

### Object Processing Pipeline
- **Single Value Detection**: Logic to identify objects suitable for literal extraction
- **Structural Validation**: Validation rules for object complexity limits
- **Value Extraction**: Safe extraction of values from validated simple objects
- **Integration with Text Mining**: Apply text extraction to object values

### Error Recovery and Validation
- **Graceful Failure**: Never throw uncaught exceptions, return structured errors
- **Clear Error Messages**: Specific error messages for different failure scenarios
- **Validation Pipeline**: Integrated validation with Zod literal schemas
- **Context Preservation**: Maintain parsing context for debugging

## Success Criteria

### Core Functionality
- All 64 tests in `literals.test.ts` pass with 100% success rate
- Accurate literal matching for all supported types (string, number, boolean)
- Reliable case coercion for string literals in all contexts
- Robust text extraction from mixed content and object values

### Advanced Features  
- Proper union literal resolution with ambiguity detection
- Object single value extraction with appropriate validation
- Quote handling in all contexts (escaped, positioned, mixed)
- Streaming and partial input handling with clear error messages

### Quality Standards
- 100% test coverage for all literal parsing scenarios
- Behavioral parity with Rust implementation for all test cases
- Performance comparable to direct literal comparison for simple cases
- Memory efficient processing even for complex text extraction scenarios

### Integration Requirements
- Seamless integration with existing deserializer and scoring systems
- Proper error propagation and handling within parser pipeline  
- Consistent API behavior matching other coercer implementations
- Full TypeScript type safety with generic literal schema support