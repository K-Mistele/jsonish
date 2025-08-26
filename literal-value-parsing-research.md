# Literal Value Parsing Feature Research

## Executive Summary

The literal value parsing feature (`07-literal-value-parsing`) is currently failing 22 out of 36 tests in `literals.test.ts`. The main issue is that the TypeScript implementation lacks comprehensive support for `z.ZodLiteral` schemas, including case-insensitive matching, text extraction, and single-value object extraction.

## Test Results Analysis

### Passing Tests (14/36)
- Basic literal parsing for exact matches (integers, booleans, exact strings)
- Some union literal tests with exact matches

### Failing Tests (22/36)
1. **Case Coercion Failures (4 tests)**: String literals with mismatched case (e.g., "Two" → "TWO")
2. **Text Extraction Failures (8 tests)**: Extracting literals from mixed text content
3. **Object Single Value Extraction Failures (6 tests)**: Extracting literals from objects with single key-value pairs
4. **Streaming/Ambiguity Issues (3 tests)**: Incomplete JSON handling and ambiguous parsing
5. **Quote Handling Failures (2 tests)**: Complex quoted string processing

## Rust Implementation Analysis

### Key Components in Rust

#### 1. Literal Coercion (`coerce_literal.rs`)
- **Direct matching**: First attempts exact type matching
- **Object single-value extraction**: Extracts primitives from objects with single key-value pairs
- **Type-specific coercion**: Delegates to `coerce_int`, `coerce_bool`, and `match_string` functions
- **Completion state handling**: Tracks incomplete/streaming states

#### 2. String Matching (`match_string.rs`)
- **Multi-strategy matching**:
  1. Case-sensitive exact match
  2. Case-sensitive without punctuation
  3. Case-insensitive match
  4. Substring matching with position scoring
- **Accent removal**: Handles international characters and ligatures
- **Punctuation stripping**: Removes non-alphanumeric characters (except `-` and `_`)
- **Ambiguity detection**: Flags multiple matches and prevents ambiguous results

#### 3. Critical Features
- **Object-to-primitive extraction**: `if obj.len() == 1 { extract_value }`
- **Progressive fallback**: Exact → unaccented → case-insensitive → substring
- **Text extraction**: Finds literal values within larger text content
- **Completion tracking**: Handles partial/streaming JSON input

## TypeScript Implementation Gaps

### 1. Missing `z.ZodLiteral` Handler
The `coerceValue` function in `parser.ts` has no case for `z.ZodLiteral`, causing it to fall through to the generic `schema.parse(coerceValueGeneric(value))`, which only handles exact matches.

### 2. No String Matching System
Unlike the Rust implementation's sophisticated `match_string` function, the TypeScript version lacks:
- Case-insensitive matching
- Punctuation stripping
- Substring extraction from text
- Multi-strategy progressive fallback

### 3. Missing Object Single-Value Extraction
The Rust implementation extracts primitive values from single-key objects:
```rust
if let jsonish::Value::Object(obj, completion_state) = value {
    if obj.len() == 1 {
        let (key, inner_value) = obj.iter().next().unwrap();
        // Extract primitive values
    }
}
```
This is completely missing in TypeScript.

### 4. No Text Content Processing
The TypeScript implementation cannot extract literal values from mixed text content like:
- "The answer is TWO" → "TWO"
- "TWO is the answer" → "TWO"
- 'The answer is "TWO"' → "TWO"

## Required Implementation Changes

### 1. Add Literal Coercion Handler
```typescript
if (schema instanceof z.ZodLiteral) {
  return coerceLiteral(value, schema, ctx) as z.infer<T>;
}
```

### 2. Implement `coerceLiteral` Function
- Handle number, boolean, and string literal types
- Support object single-value extraction for primitives
- Delegate to appropriate type-specific coercion

### 3. Create String Matching System
Implement progressive matching strategy:
1. **Exact match**: Direct string comparison
2. **Case-insensitive match**: `.toLowerCase()` comparison
3. **Punctuation-stripped match**: Remove non-alphanumeric characters
4. **Substring match**: Find literal within larger text content
5. **Accent removal**: Handle international characters (optional)

### 4. Enhance Union Handling
The current union coercion needs to:
- Handle ambiguous matches properly (should fail)
- Support object single-value extraction in union contexts
- Implement proper scoring for multiple matches

### 5. Add Text Extraction Utilities
- Extract quoted strings from text
- Find literal values in mixed content
- Handle whitespace and punctuation around literals

## Implementation Priority

### High Priority (Critical for passing tests)
1. **ZodLiteral handler** in `coerceValue` function
2. **Basic string matching** with case-insensitive support
3. **Object single-value extraction** for union literals
4. **Text extraction** for literals within sentences

### Medium Priority (Important for completeness)
1. **Punctuation stripping** and normalization
2. **Streaming/incomplete JSON** handling
3. **Ambiguity detection** and error reporting

### Low Priority (Nice to have)
1. **Accent removal** for international support
2. **Advanced substring scoring** algorithm
3. **Detailed completion state tracking**

## Test Coverage Requirements

The implementation must pass all tests in `literals.test.ts`:
- **Basic Literal Tests** (5 tests): Integer, boolean, and string exact matches
- **String Literal with Case Coercion** (4 tests): Case-insensitive string matching
- **Text Extraction Tests** (4 tests): Finding literals in mixed text
- **Quote Position Tests** (4 tests): Handling quoted literals in text
- **Special Cases** (3 tests): Complex scenarios with formatting issues
- **Union Literal Tests** (4 tests): Literal matching within unions
- **Object Single Value Extraction** (4 tests): Extracting from single-key objects
- **Ambiguity Tests** (2 tests): Handling ambiguous input
- **Object Edge Cases** (3 tests): Proper failure for complex objects
- **Quote Handling Tests** (2 tests): Complex quote processing
- **Partial Tests** (1 test): Nullable literal handling

## Architecture Considerations

### File Organization
- Add `coerce-literal.ts` for literal-specific coercion logic
- Enhance `coercer.ts` with string matching utilities
- Create `text-extractor.ts` for mixed content processing

### Performance
- Cache compiled regex patterns for text extraction
- Optimize string comparison operations
- Consider lazy evaluation for complex matching strategies

### Maintainability
- Keep coercion strategies modular and testable
- Document fallback behavior clearly
- Align with Rust implementation patterns where possible

## Conclusion

The literal value parsing feature requires significant implementation work, primarily around adding proper `z.ZodLiteral` support with sophisticated string matching capabilities. The Rust implementation provides a clear blueprint for the required functionality, and implementing these features will enable all 22 failing tests to pass.