---
date: 2025-01-24T11:47:32-08:00
researcher: Claude
git_commit: b65765cbc794f87b263adc69794bb0afe430ba9c
branch: master
repository: jsonish
topic: "Basic JSON Parsing Implementation Strategy"
tags: [implementation, strategy, parser, deserializer, coercer, jsonish, multi-object, markdown]
status: complete
last_updated: 2025-01-24
last_updated_by: Claude
type: implementation_strategy
---

# Basic JSON Parsing Implementation Plan

## Overview

This implementation strategy addresses the failing basic parsing functionality tests, focusing on fixing 6 specific test failures out of 67 total tests in `test/basics.test.ts`. The core issue is that while the JSONish parser architecture is well-designed, several key scenarios aren't working correctly: multi-object array parsing, markdown code block selection, and complex malformed JSON recovery.

## Current State Analysis

Based on comprehensive research of the codebase, the JSONish parser has solid architecture with:

- **Multi-object parsing**: `/Users/kyle/Documents/Projects/jsonish/src/jsonish/parser/multi-json-parser.ts` handles object extraction
- **Markdown extraction**: `/Users/kyle/Documents/Projects/jsonish/src/jsonish/parser/markdown-parser.ts` processes code blocks  
- **Type coercion**: Robust deserializer system with Zod schema integration
- **Error recovery**: Fixing parser with state machine approach

### Key Discoveries:
- Multi-object parser at `src/jsonish/parser/multi-json-parser.ts:15-89` uses bracket tracking but only returns first object in some cases
- Markdown parser at `src/jsonish/parser/markdown-parser.ts:54-133` has regex-based block detection that may select wrong blocks
- Null/undefined handling distinction in coercion system at `src/deserializer/coercer/field_type.ts:45-52`

## What We're NOT Doing

- Complete parser rewrite (architecture is sound)
- Changes to the Zod schema integration approach
- Modifications to the core Value type system
- Breaking changes to the public API
- Performance optimizations (focus on correctness first)

## Implementation Approach

The strategy focuses on targeted fixes to specific parsing scenarios while maintaining the existing parser → value → deserializer → coercer pipeline. Each fix will be isolated and testable using the failing test cases as verification.

## Phase 1: Multi-Object Array Parsing Fix

### Overview
Fix the multi-object parser to correctly extract and array-wrap multiple JSON objects when the target schema is an array type.

### Changes Required:

#### 1. Multi-Object Parser Logic
**File**: `src/jsonish/parser/multi-json-parser.ts`
**Changes**: Enhance bracket tracking and object boundary detection

**Current Issue**: Lines 21-65 use basic bracket tracking but may miss object boundaries in mixed text
**Fix Strategy**: 
- Improve text scanning to handle prefix/suffix content properly
- Ensure all valid JSON objects are extracted, not just the first
- Handle malformed JSON within the multi-object context

#### 2. Entry Parser Integration  
**File**: `src/jsonish/parser/entry.ts`
**Changes**: Ensure multi-object results are properly handled for array schemas

**Current Issue**: Lines 169-189 create `any_of` choices but may not prioritize array results correctly
**Fix Strategy**:
- When target schema is array type, prioritize array-wrapped results
- Ensure proper scoring for array vs single object matches

### Success Criteria:

**Automated verification**
- [ ] `bun test test/basics.test.ts` passes the multi-object array tests (lines 408-414, 424-430)
- [ ] `bun build` completes without errors
- [ ] No TypeScript errors

**Manual Verification**
- [ ] Input `'{"key": "value1"} {"key": "value2"}'` with array schema returns `[{key: "value1"}, {key: "value2"}]`
- [ ] Mixed content with multiple objects correctly extracts both objects
- [ ] Single object schema still returns first object only

## Phase 2: Markdown Code Block Selection

### Overview
Fix markdown parser to select the appropriate code block when multiple blocks exist and target schema can help discriminate.

### Changes Required:

#### 1. Markdown Parser Block Selection
**File**: `src/jsonish/parser/markdown-parser.ts`
**Changes**: Implement schema-aware block selection logic

**Current Issue**: Lines 63-95 extract all blocks but may not select the best match
**Fix Strategy**:
- Parse all extracted code blocks
- Use deserializer scoring to rank blocks against target schema
- Return the block that best matches the expected type

#### 2. Block Scoring Integration
**File**: `src/deserializer/score.ts` integration
**Changes**: Apply scoring to markdown block candidates

**Fix Strategy**:
- Score each parsed block result against target schema
- Select block with lowest error score (highest success score)
- Fall back to first valid block if scoring is inconclusive

### Success Criteria:

**Automated verification**
- [ ] `bun test test/basics.test.ts` passes markdown block selection test (lines 637-643)
- [ ] Schema `z.array(z.number())` correctly selects `["1", "2"]` block over object block
- [ ] No regressions in other markdown parsing tests

**Manual Verification**
- [ ] Multiple code blocks with different types select appropriate match
- [ ] Invalid JSON in non-selected blocks doesn't cause failures
- [ ] Maintains backward compatibility with single block scenarios

## Phase 3: Null vs Undefined Handling

### Overview
Fix the distinction between `null` and `undefined` values in the coercion system to match Zod schema expectations.

### Changes Required:

#### 1. Optional Field Coercion
**File**: `src/deserializer/coercer/field_type.ts`
**Changes**: Distinguish between missing fields (undefined) vs explicit null values

**Current Issue**: Lines 45-52 may convert undefined to null incorrectly
**Fix Strategy**:
- When field is missing from input, return `undefined` for optional fields
- When field has `null` value, return `null` 
- Preserve the distinction through the coercion pipeline

#### 2. Object Field Processing
**File**: `src/deserializer/coercer/ir_ref/coerce_class.ts`
**Changes**: Handle missing vs null fields in object parsing

**Fix Strategy**:
- Track which fields are present vs absent in input
- Apply appropriate undefined/null values based on presence and schema

### Success Criteria:

**Automated verification**
- [ ] `bun test test/basics.test.ts` passes localization test (lines 804-810)
- [ ] Missing optional fields return `undefined`, not `null`
- [ ] Explicit null values remain `null`

**Manual Verification**
- [ ] Zod optional fields with missing data return `undefined`
- [ ] Zod nullable fields with missing data return `null`
- [ ] Explicit null values in JSON preserved as `null`

## Phase 4: Complex Nested Parsing & Triple Quote Handling

### Overview
Fix complex malformed JSON parsing and triple-quoted string extraction for nested object scenarios.

### Changes Required:

#### 1. Triple Quote String Handling
**File**: `src/jsonish/parser/fixing-parser/json-collection.ts`
**Changes**: Enhance triple quote collection detection

**Current Issue**: Lines 7-23 define collection types but triple quote handling may be incomplete
**Fix Strategy**:
- Ensure `tripleQuotedString` collection properly handles nested content
- Fix state transitions for complex nested parsing scenarios

#### 2. Malformed JSON Recovery
**File**: `src/jsonish/parser/fixing-parser/fixing-parser.ts`
**Changes**: Improve error recovery for deeply nested malformed structures

**Fix Strategy**:
- Enhance state machine to handle complex malformed sequences
- Prevent incorrect field assignment during error recovery
- Maintain proper context during nested object parsing

### Success Criteria:

**Automated verification**
- [ ] `bun test test/basics.test.ts` passes complex nested test (lines 871-877)
- [ ] `bun test test/basics.test.ts` passes malformed JSON test (lines 1106-1112)
- [ ] Triple-quoted strings in nested objects parse correctly

**Manual Verification**
- [ ] Complex malformed JSON with mixed content parses without field corruption
- [ ] Triple-quoted strings preserve multi-line content properly
- [ ] Error recovery doesn't assign content to wrong fields

## Test Strategy

### Primary Validation Command
```bash
bun test test/basics.test.ts
```

This command validates the implementation strategy and must pass all 67 tests, with specific focus on the 6 currently failing tests.

### Unit Tests
- [ ] Multi-object parsing edge cases in `test/basics.test.ts:408-430`
- [ ] Markdown block selection in `test/basics.test.ts:637-643`
- [ ] Null/undefined distinction in `test/basics.test.ts:804-810`
- [ ] Complex nested parsing in `test/basics.test.ts:871-877, 1106-1112`

### Integration Tests
- [ ] End-to-end parsing with Zod schemas maintains type safety
- [ ] Multi-strategy parsing fallback chain works correctly
- [ ] Error recovery doesn't break valid parsing scenarios

## Performance Considerations
- Multi-object parsing may scan text multiple times - minimize regex operations
- Markdown block scoring adds overhead - cache scoring results when possible
- Complex error recovery can be expensive - limit retry attempts

## Migration Notes
- All changes are internal to parser/deserializer - no API changes
- Existing valid parsing scenarios should continue working unchanged
- Error handling behavior may improve but shouldn't break existing error handling

## References 
* Original requirements: `specifications/01-basic-parsing/feature.md`
* Related research: `specifications/01-basic-parsing/research_2025-07-24_03-23-13_rust-object-class-parsing-architecture.md`
* Multi-object parser: `src/jsonish/parser/multi-json-parser.ts:15-89`
* Markdown parser: `src/jsonish/parser/markdown-parser.ts:54-133`
* Type coercion: `src/deserializer/coercer/field_type.ts:45-52`
* Test validation: `test/basics.test.ts:408-1112` (failing test ranges)