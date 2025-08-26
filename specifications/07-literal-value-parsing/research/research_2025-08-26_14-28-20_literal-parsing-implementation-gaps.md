---
date: 2025-08-26T14:28:20-05:00
researcher: Claude Code
git_commit: 3243ea561b1a1ab582edf9ed411f85716d98505b
branch: master
repository: jsonish
topic: "07-literal-value-parsing implementation gaps and Rust comparison"
tags: [research, codebase, literal-parsing, zod-literal, rust-implementation, union-resolution, object-extraction, case-coercion, text-extraction]
status: complete
last_updated: 2025-08-26
last_updated_by: Claude Code
type: research
---

# Research: 07-literal-value-parsing Implementation Gaps and Rust Comparison

**Date**: 2025-08-26T14:28:20-05:00
**Researcher**: Claude Code
**Git Commit**: 3243ea561b1a1ab582edf9ed411f85716d98505b
**Branch**: master
**Repository**: jsonish

## Research Question
Review the feature for 07-literal-value-parsing, research the existing Rust implementation to understand what is implemented and how, determine what tests in literals.test.ts are failing, and figure out what needs to be implemented or changed in TypeScript.

## Summary
The TypeScript JSONish parser is missing comprehensive `z.ZodLiteral` support, causing 22 out of 36 literal parsing tests to fail. The main gaps are:
1. **No ZodLiteral handler** in the main coercion pipeline
2. **Missing object single-value extraction** for literal unions  
3. **No case coercion logic** for string literals
4. **Missing text extraction patterns** for literals in mixed content
5. **Insufficient union resolution** for literal types

The Rust implementation provides a sophisticated multi-layer approach with case-insensitive matching, punctuation stripping, accent removal, and object primitive extraction that needs to be ported to TypeScript.

## Test Failure Analysis

**Current Test Results**: 14 pass, 22 fail out of 36 total tests

### Failing Test Categories
- **Case Coercion Tests**: `"Two"` → `"TWO"` fails (lines 74-90 in literals.test.ts)
- **Text Extraction Tests**: `"The answer is TWO"` → `"TWO"` fails (lines 93-128)
- **Object Single Value Extraction**: `{"status": 1}` → `1` for literal unions fails (lines 234-294)
- **Union Literal Resolution**: Various union scenarios fail due to missing literal support
- **Quote Handling**: Quoted literals in objects and text fail (lines 372-402)
- **Streaming Edge Cases**: Some incomplete input handling issues (line 321)

### Root Cause
The `coerceValue` function in `/Users/kyle/Documents/Projects/jsonish/jsonish/src/parser.ts:522-605` has no case for `z.ZodLiteral`, causing all literal schemas to fall through to generic schema validation which only accepts exact matches.

## Detailed Findings

### Rust Implementation Architecture

#### Core Components from BAML Reference

**File**: `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_literal.rs`
- **Lines 18-66**: `try_cast()` method for exact literal matching
- **Lines 68-147**: `coerce()` method with sophisticated literal coercion
- **Lines 89-108**: Object single-value extraction for literals
- **Lines 110-146**: Type-specific coercion (integers, booleans, strings)

**File**: `baml/engine/baml-lib/jsonish/src/deserializer/coercer/match_string.rs`
- **Lines 39-133**: Multi-layer string matching algorithm
- **Lines 74-78**: Exact case-sensitive match (highest priority)
- **Lines 80-110**: Punctuation stripping and retry logic
- **Lines 115-130**: Case-insensitive fallback matching
- **Lines 135-159**: Unicode normalization and accent removal
- **Lines 192-328**: Substring matching with position-based scoring

#### Advanced String Matching Algorithm
1. **Exact case-sensitive match** - Direct comparison for performance
2. **Strip punctuation + case-sensitive match** - Remove special characters
3. **Case-insensitive match without punctuation** - Broad matching
4. **Accent removal and ligature replacement** - International support
5. **Substring matching with overlap resolution** - Extract from mixed text

#### Object Single-Value Extraction Pattern
```rust
// From coerce_literal.rs:89-108
if let jsonish::Value::Object(obj, completion_state) = value {
    if obj.len() == 1 {
        let (key, inner_value) = obj.iter().next().unwrap();
        match inner_value {
            jsonish::Value::Number(_, _)
            | jsonish::Value::Boolean(_)
            | jsonish::Value::String(_, _) => {
                let mut result = self.coerce(ctx, target, Some(inner_value))?;
                result.add_flag(Flag::ObjectToPrimitive(obj.clone()));
                return Ok(result);
            }
            _ => {}
        }
    }
}
```

### TypeScript Implementation Gaps

#### Missing ZodLiteral Handler
**Location**: `jsonish/src/parser.ts:522-605`
**Issue**: No `z.ZodLiteral` case in the main `coerceValue` function
**Required Addition**:
```typescript
if (schema instanceof z.ZodLiteral) {
  return coerceLiteral(value, schema, ctx) as z.infer<T>;
}
```

#### Missing Literal Coercer Implementation
**Location**: `jsonish/src/coercer.ts` (needs new function)
**Required**: `coerceLiteral()` function implementing:
- Exact value matching for numbers, booleans, strings
- Case-insensitive string matching following Rust patterns
- Text extraction with substring matching
- Single-value object extraction with validation

#### Missing Case Coercion Logic
**Current Gap**: No case-insensitive matching for string literals
**Required Features**:
- Case conversion (uppercase/lowercase/mixed)
- Punctuation stripping (keep alphanumeric, '-', '_')
- Substring matching with position prioritization
- Unicode normalization for international support

#### Missing Object Single Value Extraction
**Test Requirements**:
- `{"status": 1}` → `1` for `z.literal(1)`
- `{"result": true}` → `true` for `z.literal(true)`
- `{"value": "THREE"}` → `"THREE" for `z.literal("THREE")`
- **Reject**: Multi-key objects, nested objects, arrays

#### Union Resolution Improvements
**Current Issue**: Line 980 in `coerceUnion()` throws "No union option matched value"
**Required**: Better literal handling in union fallback strategies
**Missing Scoring**: Literal match scoring in `calculateUnionScore()` function

### Text Extraction Requirements

#### Pattern Examples from Tests
- **Prefix extraction**: `"The answer is TWO"` → `"TWO"`
- **Suffix extraction**: `"TWO is the answer"` → `"TWO"`
- **Quote handling**: `'The answer is "TWO"'` → `"TWO"`
- **Case coercion during extraction**: `"The answer is Two"` → `"TWO"`
- **Special character filtering**: `'"TWO!@#"'` → `"TWO"`
- **Whitespace trimming**: `'"  TWO  "'` → `"TWO"`

#### Required Algorithm (Based on Rust Implementation)
1. **Direct match** - Try exact case-sensitive match first
2. **Clean and retry** - Strip quotes, whitespace, special characters
3. **Case-insensitive match** - Convert case to match expected literal
4. **Substring extraction** - Find literal within larger text
5. **Position-based disambiguation** - Handle multiple matches

## Code References

### Current TypeScript Architecture
- `jsonish/src/index.ts:1-20` - Main parser entry point with `createParser()` and `parse()` functions
- `jsonish/src/parser.ts:15-130` - Multi-strategy parsing engine with 6 fallback strategies
- `jsonish/src/parser.ts:522-605` - Main `coerceValue()` function **missing ZodLiteral support**
- `jsonish/src/parser.ts:872-986` - Union resolution system with scoring
- `jsonish/src/parser.ts:1178-1273` - Union scoring algorithm
- `jsonish/src/coercer.ts:4-285` - Type coercion utilities **missing literal coercion**
- `jsonish/src/value.ts:3-85` - Internal value representation system

### Missing Implementation Points
- `jsonish/src/parser.ts:524` - Add ZodLiteral case after ZodBoolean handler
- `jsonish/src/coercer.ts:285+` - Add `coerceLiteral()` function implementation
- `jsonish/src/parser.ts:1183-1211` - Add literal scoring in union resolution
- `jsonish/src/coercer.ts:145-153` - Add literal extraction to `extractFromText()`

### Test Coverage Analysis
- `test/literals.test.ts:1-417` - Comprehensive literal parsing test suite
- `test/literals.test.ts:8-52` - Basic literal tests (5 tests) - mostly pass
- `test/literals.test.ts:55-91` - String case coercion tests (4 tests) - all fail
- `test/literals.test.ts:93-128` - Text extraction tests (4 tests) - all fail
- `test/literals.test.ts:234-294` - Object single value extraction (3 tests) - all fail
- `test/literals.test.ts:296-323` - Ambiguity handling tests (2 tests) - 1 fail
- `test/literals.test.ts:405-415` - Partial object handling (1 test) - fail

### Rust Reference Implementation
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_literal.rs:18-147` - Main literal coercer
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/match_string.rs:39-328` - String matching algorithms
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_union.rs:1-287` - Union resolution with scoring
- `baml/engine/baml-lib/jsonish/src/deserializer/score.rs:34-77` - Scoring system with flags

## Parser Flow Analysis

### Current Flow (Incomplete for Literals)
1. Raw input → `parser.ts:parseBasic()` → strategy selection
2. JSON parsing/extraction → `Value` construction  
3. `coerceValue()` → **falls through for ZodLiteral** → generic schema validation
4. **Result**: Only exact matches work, no coercion/extraction

### Required Flow (Following Rust Pattern)
1. Raw input → parser strategies → `Value` construction
2. `coerceValue()` → detect `ZodLiteral` → call `coerceLiteral()`
3. `coerceLiteral()` → try exact match → case coercion → text extraction → object extraction
4. Union resolution → score literal matches → select best option
5. **Result**: Robust literal parsing with multiple fallback strategies

## Architecture Insights

### Key Patterns from Rust Implementation
- **Multi-layer fallback strategy** - Try exact matches first, then progressively more permissive
- **Flag-based scoring system** - Track transformations for union resolution
- **Object primitive extraction** - Single-key objects can yield primitive literals
- **Unicode normalization** - Handle international text properly
- **Position-based disambiguation** - Resolve ambiguous substring matches
- **Type-aware processing** - Different strategies for different literal types

### Integration Requirements
- **Zod schema integration** - Access `schema._def.value` for expected literal
- **Error handling consistency** - Match existing parser error patterns
- **Scoring system integration** - Add literal scores to union resolution
- **Context preservation** - Maintain parsing context for debugging

## Implementation Strategy

### Phase 1: Core ZodLiteral Support
1. Add `z.ZodLiteral` case to `coerceValue()` function
2. Implement basic `coerceLiteral()` function with exact matching
3. Add literal support to union resolution system

### Phase 2: Advanced String Matching
1. Implement multi-layer string matching algorithm
2. Add case coercion with punctuation stripping
3. Add Unicode normalization for international support

### Phase 3: Text Extraction and Object Processing
1. Implement substring matching with position awareness  
2. Add object single-value extraction with validation
3. Integrate text extraction patterns into literal coercion

### Phase 4: Union Resolution and Scoring
1. Add literal-specific scoring to union resolution
2. Implement ambiguity detection and handling
3. Add comprehensive error messages for edge cases

## Success Criteria

### Functional Requirements
- All 36 tests in `literals.test.ts` pass with 100% success rate
- Behavioral parity with Rust implementation for all test scenarios
- Proper case coercion for string literals in all contexts
- Robust object single-value extraction with appropriate validation

### Quality Standards
- Performance comparable to direct literal comparison for simple cases
- Memory-efficient processing for complex text extraction scenarios
- Consistent API behavior matching other coercer implementations
- Full TypeScript type safety with generic literal schema support

## Related Documentation
- `specifications/07-literal-value-parsing/feature.md` - Complete feature specification
- `CLAUDE.md` - JSONish architecture and development guidelines
- `test/literals.test.ts` - Comprehensive test suite with 36 test cases

## Open Questions
1. Should Unicode normalization use a TypeScript library equivalent to Rust's `unicode_normalization`?
2. What's the performance impact of multi-layer string matching vs. direct Zod validation?
3. How should streaming/incomplete JSON be handled for literal extraction edge cases?
4. Should object extraction support nested single-key chains (e.g., `{"a": {"b": 1}}` → `1`)?