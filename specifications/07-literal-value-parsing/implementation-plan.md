---
date: 2025-07-24T08:15:23-08:00
researcher: Claude
git_commit: 6670bcdf3d8b4d80f1dcc6c7ece6b087d08bf578
branch: master
repository: jsonish
topic: "Literal Value Parsing Implementation Strategy"
tags: [implementation, strategy, parser, deserializer, coercer, jsonish, literal-parsing, text-extraction, case-coercion, union-resolution]
status: complete
last_updated: 2025-07-24
last_updated_by: Claude
type: implementation_strategy
---

# Literal Value Parsing Implementation Plan

## Overview

This implementation enhances the existing literal parsing system in JSONish with comprehensive text extraction, object single-value extraction, advanced case coercion, and union ambiguity detection. The strategy builds on the solid foundation of `literal_coercer.ts` and `match_string.ts` while adding missing capabilities to achieve full behavioral parity with the Rust implementation.

## Current State Analysis

### Key Discoveries:
- **Strong Foundation**: `src/deserializer/coercer/literal_coercer.ts:12-111` provides basic literal parsing with type conversion fallbacks
- **Sophisticated String Matching**: `src/deserializer/coercer/match_string.ts:6-72` implements 4-stage progressive matching (exact → case-insensitive → substring → fuzzy)
- **Comprehensive Test Suite**: `test/literals.test.ts` contains 41 test cases covering all required scenarios including text extraction and object single-value extraction
- **Missing Object Extraction**: Tests expect `{"status": 1}` → `1` for literal unions, but implementation is incomplete in the literal coercer

## What We're NOT Doing

- Modifying the core parser architecture or value representation system
- Changing the existing flag-based scoring system or union resolution algorithm
- Adding new coercer types - enhancing the existing literal coercer only
- Modifying streaming/partial parsing infrastructure (already works correctly)
- Creating new test files (comprehensive test suite already exists)

## Implementation Approach

The strategy follows the Rust implementation's conservative single-key object extraction at the literal coercer level, enhanced text mining through existing `matchString()` capabilities, and maintains the established first-match priority for string literals vs ambiguity failure for numeric/boolean literals.

## Phase 1: Object Single-Value Extraction

### Overview
Implement object single-value extraction directly in the literal coercer, following the Rust pattern of single-key primitive-only validation with fail-safe fallback to standard coercion.

### Changes Required:

#### 1. Enhanced Literal Coercer with Object Extraction
**File**: `src/deserializer/coercer/literal_coercer.ts`
**Changes**: Add object single-value extraction logic to lines 12-111

   ```typescript
   export function coerceLiteral(
       ctx: ParsingContext,
       target: z.ZodLiteral<any>, 
       value: Value | undefined
   ): BamlValueWithFlags | ParsingError {
       const literalValue = target.value
       
       // NEW: Object single-value extraction (following Rust coerce_literal.rs:40-59)
       if (value?.type === 'object' && value.value.length === 1) {
           const [key, singleValue] = value.value[0]
           
           // Only extract primitive values (Number, Boolean, String)
           if (singleValue.type === 'string' || singleValue.type === 'number' || singleValue.type === 'bool') {
               const flags = new DeserializerConditions()
               flags.addFlag(Flag.ObjectToPrimitive, { key })
               
               // Recursively coerce the extracted value
               const extractedResult = coerceLiteral(ctx, target, singleValue)
               if (!(extractedResult instanceof ParsingError)) {
                   // Merge flags from extraction
                   getConditions(extractedResult).mergeWith(flags)
                   return extractedResult
               }
           }
       }
       
       // Existing literal coercion logic continues...
   }
   ```

### Success Criteria:

**Automated verification**
- [ ] `bun test test/literals.test.ts` passes all object single-value extraction tests (lines 234-294)
- [ ] `bun test` passes all existing tests with no regressions
- [ ] `bun build` completes without TypeScript errors

**Manual Verification**
- [ ] Object extraction works: `{"status": 1}` with `z.union([z.literal(1), z.literal(true)])` → `1`
- [ ] Multi-key objects are rejected: `{"status": 1, "message": "success"}` → fails appropriately
- [ ] Nested objects are rejected: `{"status": {"code": 1}}` → fails appropriately
- [ ] Arrays in objects are rejected: `{"values": [1]}` → fails appropriately

## Phase 2: Enhanced Text Extraction and Case Coercion

### Overview
Enhance the existing `matchString()` algorithm to support robust text extraction from mixed content, including quoted string extraction, prefix/suffix text handling, and bidirectional case coercion.

### Changes Required:

#### 1. Enhanced String Matching Algorithm
**File**: `src/deserializer/coercer/match_string.ts`
**Changes**: Extend existing `matchString()` function at lines 6-31

   ```typescript
   export function matchString(expected: string, actual: string): boolean {
       // Stage 1: Exact match (existing)
       if (actual === expected) return true
       
       // Stage 2: Case-insensitive match (existing)
       if (actual.toLowerCase() === expected.toLowerCase()) return true
       
       // NEW: Stage 3: Quoted string extraction
       const quotedMatch = extractQuotedString(actual, expected)
       if (quotedMatch) return true
       
       // NEW: Stage 4: Text extraction with prefix/suffix support
       const textMatch = extractFromText(actual, expected)
       if (textMatch) return true
       
       // Stage 5: Substring match (existing - enhanced)
       // Stage 6: Fuzzy character match (existing)
   }
   
   function extractQuotedString(text: string, expected: string): boolean {
       // Handle: "The answer is \"TWO\"" → "TWO"
       // Handle: "\"TWO\" is the answer" → "TWO"
   }
   
   function extractFromText(text: string, expected: string): boolean {
       // Handle: "The answer is TWO" → "TWO"
       // Handle: "TWO is the answer" → "TWO"
       // With case coercion: "The answer is Two" → "TWO"
   }
   ```

#### 2. Advanced Case Coercion Support
**File**: `src/deserializer/coercer/literal_coercer.ts`
**Changes**: Enhance string literal processing at lines 38-65

   ```typescript
   // Enhanced string literal processing with bidirectional case coercion
   if (typeof literalValue === 'string') {
       if (value?.type === 'string') {
           // Try enhanced text extraction
           const enhancedMatch = matchStringWithExtraction(literalValue, value.value)
           if (enhancedMatch.matched) {
               const flags = new DeserializerConditions()
               if (enhancedMatch.wasExtracted) {
                   flags.addFlag(Flag.SubstringMatch, { matched: value.value })
               }
               if (enhancedMatch.wasCaseCoerced) {
                   flags.addFlag(Flag.CaseCoerced, { original: enhancedMatch.originalCase })
               }
               return createString(literalValue, target, flags)
           }
       }
   }
   ```

### Success Criteria:

**Automated verification**
- [ ] `bun test test/literals.test.ts` passes all text extraction tests (lines 93-129)
- [ ] Case coercion tests pass (lines 74-90)
- [ ] Quote handling tests pass (lines 130-197)
- [ ] No regressions in existing string matching

**Manual Verification**
- [ ] Text extraction: `"The answer is TWO"` → `"TWO"`
- [ ] Case coercion: `"Two"` → `"TWO"` and `"TWO"` → `"two"`
- [ ] Quoted extraction: `"The answer is \"TWO\""` → `"TWO"`
- [ ] Mixed scenarios: `"The answer is \"Two\""` → `"TWO"` (extract + coerce)

## Phase 3: Union Ambiguity Detection and Resolution

### Overview
Implement type-specific ambiguity detection maintaining first-match priority for string literals while failing appropriately for numeric and boolean literals when multiple matches are detected.

### Changes Required:

#### 1. Enhanced Union Literal Resolution
**File**: `src/deserializer/coercer/literal_coercer.ts`
**Changes**: Add ambiguity detection logic

   ```typescript
   // NEW: Ambiguity detection for union literal resolution
   function detectAmbiguousLiterals(input: string, literalOptions: any[]): {
       hasAmbiguity: boolean;
       matchedLiterals: any[];
       shouldFail: boolean;
   } {
       const matches = []
       
       for (const literal of literalOptions) {
           if (typeof literal === 'string') {
               // String literals: collect all matches for first-match selection
               if (input.includes(literal)) {
                   matches.push(literal)
               }
           } else {
               // Number/Boolean literals: detect multiple matches for failure
               if (input.includes(String(literal))) {
                   matches.push(literal)
               }
           }
       }
       
       return {
           hasAmbiguity: matches.length > 1,
           matchedLiterals: matches,
           shouldFail: matches.length > 1 && typeof literalOptions[0] !== 'string'
       }
   }
   ```

#### 2. String Union First-Match Priority
**File**: `src/deserializer/coercer/match_string.ts`
**Changes**: Enhance `matchOneFromMany()` function at lines 32-72

   ```typescript
   export function matchOneFromMany(options: string[], input: string): {
       matched: string | null;
       isAmbiguous: boolean;
   } {
       const matches = []
       
       for (const option of options) {
           if (matchString(option, input)) {
               matches.push(option)
           }
       }
       
       if (matches.length === 0) return { matched: null, isAmbiguous: false }
       if (matches.length === 1) return { matched: matches[0], isAmbiguous: false }
       
       // Multiple matches - return first match with ambiguity flag
       return { 
           matched: matches[0], 
           isAmbiguous: true 
       }
   }
   ```

### Success Criteria:

**Automated verification**
- [ ] `bun test test/literals.test.ts` passes union literal tests (lines 198-232)
- [ ] Ambiguity detection tests pass - `"2 or 3"` fails, `"true or false"` fails
- [ ] String first-match tests pass - `"TWO or THREE"` → `"TWO"`
- [ ] Union resolution integrates with scoring system

**Manual Verification**
- [ ] Numeric ambiguity: `"2 or 3"` with `z.union([z.literal(2), z.literal(3)])` → throws error
- [ ] Boolean ambiguity: `"true or false"` with boolean union → throws error  
- [ ] String first-match: `"TWO or THREE"` with string union → `"TWO"`
- [ ] Proper flag tracking with `StrMatchOneFromMany` for ambiguous scenarios

## Test Strategy

### Unit Tests
- [ ] Enhanced literal coercer tests for object extraction in `test/literals.test.ts:234-294`
- [ ] String matching algorithm tests for text extraction in `test/literals.test.ts:93-129`
- [ ] Case coercion tests for bidirectional conversion in `test/literals.test.ts:74-90`
- [ ] Union ambiguity tests for type-specific behavior in `test/literals.test.ts:198-232`

### Integration Tests
- [ ] End-to-end parsing with complex literal scenarios
- [ ] Union literal resolution with scoring integration
- [ ] Streaming literal parsing with completion state handling
- [ ] Object single-value extraction with nested literal unions

## Performance Considerations

**Text Extraction Performance**: 4-stage progressive matching may add latency for complex text extraction scenarios. The existing implementation already handles this efficiently through early returns.

**Object Extraction Overhead**: Single-key validation adds minimal computational cost and prevents expensive traversal of complex nested structures.

**Memory Usage**: Flag tracking for transformations adds metadata but enables optimal union resolution through the scoring system.

## Migration Notes

**Backward Compatibility**: All changes enhance existing functionality without breaking current behavior. Existing tests continue to pass.

**Flag Integration**: New flags (`ObjectToPrimitive`, `CaseCoerced`) integrate with existing scoring system for union resolution quality assessment.

**Error Handling**: Enhanced error messages for ambiguous literal scenarios provide clearer debugging information while maintaining existing error recovery patterns.

## References 

* Original requirements: `specifications/07-literal-value-parsing/feature.md`
* Related research: `specifications/07-literal-value-parsing/research_2025-07-24_04-36-18_rust-literal-value-parsing-architecture.md`
* Rust implementation: `src/deserializer/coercer/coerce_literal.rs:40-59` (object extraction)
* String matching: `src/deserializer/coercer/match_string.rs:21-220` (4-stage matching)
* Test examples: `test/literals.test.ts:234-294` (object single-value extraction)
* Union resolution: `src/deserializer/coercer/coerce_union.rs:7-32` (parallel evaluation)
* Scoring system: `src/deserializer/score.rs:34-77` (flag-based penalties)