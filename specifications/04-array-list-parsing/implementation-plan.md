---
date: 2025-08-26T16:08:42+0000
researcher: Claude
git_commit: a985477bdab3c15af6b36a1fd76afb3d5fa21444
branch: master
repository: jsonish
topic: "Array and List Parsing Implementation Strategy"
tags: [implementation, strategy, parser, deserializer, coercer, jsonish, arrays, malformed-json, type-coercion]
status: complete
last_updated: 2025-08-26
last_updated_by: Claude
type: implementation_strategy
---

# Array and List Parsing Implementation Plan

## Overview

This implementation plan addresses comprehensive array and list parsing capabilities for the JSONish parser, focusing on fixing critical bugs and implementing missing features for malformed array handling, union type resolution, and streaming support. The plan prioritizes fixing the blocking type definition inconsistency and failing tests while maintaining architectural consistency.

## Current State Analysis

The JSONish parser has a solid 6-strategy fallback system with comprehensive test coverage (30 primary tests), but critical issues prevent proper array functionality:

### Key Discoveries:
- **BLOCKING BUG**: Type definition inconsistency between `value.ts:9` (uses `items`) and `coercer.ts:25,177,202` + `parser.ts:485` (expect `elements`)
- **Missing union scoring system**: `parser.ts:807` TODO comment - currently uses first-match instead of best-match
- **6/30 tests failing**: Array parsing falls back to string mode instead of proper array handling for malformed input
- **Malformed array recovery gaps**: Limited support for unquoted elements, mixed quotes, escaped quotes

### Architectural Strengths:
- Multi-strategy parser with array-specific logic `parser.ts:24-114`
- Element-level coercion system `parser.ts:723-786`
- State machine array parsing `state-machine.ts:190-252`
- Mixed content extraction `extractors.ts:158-198`

## What We're NOT Doing

- BAML language-specific features or DSL functionality
- Performance optimizations beyond current capabilities
- test framework changes - using existing Bun test structure
- Major architectural changes - working within established multi-strategy system

## Implementation Approach

Fix critical bugs first, then enhance array parsing capabilities through the existing 6-strategy system: JSON.parse → extraction → fixing → state machine → text extraction → partial parsing. Focus on making malformed JSON arrays work like the Rust implementation while maintaining TypeScript/Zod integration patterns.

## Phase 1: Critical Type Definition Fix

### Overview
Fix the blocking type definition inconsistency that prevents array coercion from working correctly.

### Changes Required:

#### 1. Fix Coercer Type References
**File**: `jsonish/src/coercer.ts`
**Changes**: Replace all `value.elements` references with `value.items`

   ```typescript
   // Line 25: Fix array to string conversion
   - value.elements.map(element => getValueAsJavaScript(element)).join(', ')
   + value.items.map(element => getValueAsJavaScript(element)).join(', ')

   // Line 177: Fix JavaScript array conversion
   - return value.elements.map(element => getValueAsJavaScript(element))
   + return value.items.map(element => getValueAsJavaScript(element))

   // Line 202: Fix TypeScript string formatting
   - value.elements.map(element => valueToTypeScriptString(element)).join(', ')
   + value.items.map(element => valueToTypeScriptString(element)).join(', ')
   ```

#### 2. Fix Parser Type References
**File**: `jsonish/src/parser.ts`
**Changes**: Replace `value.elements` reference with `value.items`

   ```typescript
   // Line 485: Fix array element extraction
   - return value.elements.map(el => getValueAsJS(el))
   + return value.items.map(el => getValueAsJS(el))
   ```

### Success Criteria:

**Automated Verification**
- [ ] `bun test ./test/lists.test.ts` passes more than current 24/30 tests
- [ ] `bun build` completes without TypeScript errors
- [ ] No runtime "elements is undefined" errors

**Manual Verification**
- [ ] Basic array parsing works: `[1, 2, 3]` → `[1, 2, 3]`
- [ ] Array coercion functions execute without property errors
- [ ] Type definition consistency verified across all files

## Phase 2: Malformed Array Recovery Enhancement

### Overview
Implement comprehensive malformed array recognition and fixing capabilities to handle unquoted elements, mixed quotes, and escaped quotes.

### Changes Required:

#### 1. Enhanced Array Pattern Detection
**File**: `jsonish/src/extractors.ts`
**Changes**: Improve array pattern recognition for malformed syntax

   ```typescript
   // Enhance extractJsonPatterns() to handle unquoted arrays
   - const arrayPattern = /\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/g
   + const unquotedArrayPattern = /\[[a-zA-Z0-9_\s,'"]*\]/g
   // Add to extractJsonPatterns logic to handle unquoted elements
   ```

#### 2. Array-Specific JSON Fixing
**File**: `jsonish/src/fixing-parser.ts`  
**Changes**: Add array-specific malformation fixes

   ```typescript
   // Add fixArrayJson() function to handle:
   // - Unquoted string elements: [hello, world] → ["hello", "world"]
   // - Mixed quotes: ["hello", 'world', test] → ["hello", "world", "test"]
   // - Escaped quotes: [""a"", ""b""] → ['"a"', '"b"']
   ```

#### 3. State Machine Array Enhancement
**File**: `jsonish/src/state-machine.ts`
**Changes**: Improve malformed array element parsing

   ```typescript
   // Enhance parseArray() to handle unquoted elements
   // Add logic to detect and quote unquoted string tokens
   // Improve comma-separated value detection
   ```

### Success Criteria:

**Automated Verification**
- [ ] `bun test ./test/lists.test.ts` passes at least 28/30 tests
- [ ] Malformed array tests pass: `[hello, world, test]` → `["hello", "world", "test"]`
- [ ] Mixed quote tests pass: `["hello", 'world', test]` → `["hello", "world", "test"]`

**Manual Verification**
- [ ] Unquoted array parsing works correctly
- [ ] Escaped quote handling: `[""a"", ""b""]` → `['"a"', '"b"']`
- [ ] Mixed content extraction preserves array structure

## Phase 3: Union Type Scoring System

### Overview
Implement the missing union type scoring system to replace first-match selection with best-match selection for array elements.

### Changes Required:

#### 1. Union Scoring Implementation
**File**: `jsonish/src/parser.ts`
**Changes**: Replace TODO with scoring system

   ```typescript
   // Lines 788-808: Replace TODO with scoring implementation
   if (schema.element instanceof z.ZodUnion) {
     // Implement scoring system similar to Rust array_helper.rs:26-287
     const scoredOptions = schema.element.options.map(option => ({
       option,
       score: calculateUnionScore(coercedItems, option, ctx)
     }))
     const bestOption = scoredOptions.reduce((best, current) => 
       current.score > best.score ? current : best
     )
     return bestOption.option.parse(coercedItems)
   }
   ```

#### 2. Scoring Algorithm
**File**: `jsonish/src/parser.ts` 
**Changes**: Add calculateUnionScore() function

   ```typescript
   function calculateUnionScore(items: any[], schema: z.ZodType, ctx: CoercionContext): number {
     // Implement scoring based on:
     // - Successful element coercions
     // - Type match quality
     // - Error penalties
     // - Schema complexity
   }
   ```

### Success Criteria:

**Automated Verification**  
- [ ] `bun test ./test/lists.test.ts` passes 30/30 tests
- [ ] Union array tests maintain element types correctly
- [ ] No regression in existing array functionality

**Manual Verification**
- [ ] Union arrays preserve intended types: `["hello", 42, "world", 123]` keeps numbers as numbers
- [ ] Best-match selection works better than first-match
- [ ] Complex union arrays resolve correctly

## Phase 4: Streaming and Edge Case Enhancement

### Overview
Improve streaming/partial array support and handle remaining edge cases for 100% test coverage.

### Changes Required:

#### 1. Enhanced Partial Array Parsing
**File**: `jsonish/src/parser.ts`
**Changes**: Improve parsePartialArray() functionality

   ```typescript
   // Enhance lines 104-110 partial parsing strategy
   // Better incomplete array detection
   // Improved element boundary detection
   ```

#### 2. Edge Case Handling
**Files**: Various files based on remaining test failures
**Changes**: Address specific edge cases from remaining failing tests

### Success Criteria:

**Automated Verification**
- [ ] `bun test ./test/lists.test.ts` passes all 30/30 tests
- [ ] `bun build` completes without errors  
- [ ] Full test suite `bun test` passes without regression

**Manual Verification**
- [ ] Streaming arrays work: `[1234, 5678` → `[1234, 5678]`
- [ ] All edge cases from test suite handle correctly
- [ ] Performance acceptable for large arrays

## Test Strategy

### Unit Tests
- [ ] Fix existing failing tests in `test/lists.test.ts`
- [ ] Verify type coercion for array elements works correctly
- [ ] Test malformed array recovery patterns
- [ ] Test union type preservation in arrays

### Integration Tests  
- [ ] End-to-end parsing with Zod array schemas
- [ ] Mixed content array extraction scenarios
- [ ] Streaming/partial JSON array handling
- [ ] Nested array structure processing

### Regression Tests
- [ ] Ensure no existing functionality breaks
- [ ] Verify other test files still pass: `test/basics.test.ts`, `test/unions.test.ts`
- [ ] Performance remains acceptable

## Performance Considerations

- Type definition fix should improve performance by eliminating runtime errors
- Union scoring may add computational overhead but improves accuracy
- Malformed array parsing adds flexibility without impacting well-formed arrays
- Memory usage should remain comparable for typical array sizes

## Migration Notes

No breaking changes to public API - all changes are internal implementation improvements. Users will benefit from:
- More reliable array parsing from malformed input
- Better union type resolution in arrays  
- Improved error recovery and streaming support

## References 

* Original requirements: `specifications/04-array-list-parsing/feature.md`
* Implementation research: `specifications/04-array-list-parsing/research/research_2025-08-26_16-04-08_array-list-parsing-implementation-analysis.md`
* Related object parsing: `specifications/03-advanced-object-parsing/implementation-plan.md`
* Test cases: `test/lists.test.ts`
* Core parser: `jsonish/src/parser.ts:24-114`
* Array coercion: `jsonish/src/parser.ts:723-786`
* Value system: `jsonish/src/value.ts:9,34-53`