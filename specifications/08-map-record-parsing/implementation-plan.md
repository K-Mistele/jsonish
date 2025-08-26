---
date: 2025-08-26T21:15:00-08:00
researcher: Claude
git_commit: e01f8665376bfb1506edaa63d7db007cf1315854
branch: master
repository: jsonish
topic: "Map/Record Parsing Bug Fixes Implementation Strategy"
tags: [implementation, strategy, bugfix, map-parsing, record-parsing, zod, test-fixes]
status: complete
last_updated: 2025-08-26
last_updated_by: Claude
type: implementation_strategy
---

# Map/Record Parsing Bug Fixes Implementation Plan

## Overview

This implementation plan focuses on fixing existing bugs in the JSONish parser's map/record parsing functionality. The core ZodRecord support is already implemented and working (37 out of 65 tests passing), but specific edge cases and parsing scenarios need fixes to achieve full test suite compliance.

## Current State Analysis

### Key Discoveries:
- **Core functionality works**: ZodRecord support fully implemented in `jsonish/src/parser.ts:610-1514`
- **Test status**: 37 passing, 5 failing out of 65 total test scenarios
- **Architecture is sound**: Proper schema detection, coercion patterns, and union scoring exist
- **Specific bugs identified**: Escaped quotes, nested maps, union edge cases, error recovery

### What We're NOT Doing

- Complete rewrite of map/record parsing system
- Adding new Rust-style flag/penalty system
- Major architectural changes to coercion system
- Performance optimization or streaming enhancements
- New test cases or expanded functionality

## Implementation Approach

Fix existing bugs in the current implementation to make all 65 test scenarios pass, maintaining the established architecture and patterns.

## Phase 1: Escaped Quote and JSON Fixing Integration

### Overview
Fix the parsing of keys and values with escaped quotes that currently return empty objects instead of proper parsed values.

### Root Cause Analysis
Test case: `{""a"": ""b""}` returns `{}` instead of `{ '"a"': '"b"' }`

This suggests the JSON fixing parser (`fixing-parser/`) isn't properly handling escaped quotes before the map coercion runs.

### Changes Required:

#### 1. Fixing Parser Integration
**File**: `jsonish/src/parser.ts`
**Changes**: Ensure map parsing strategies properly integrate with JSON fixing

**Lines 102-123** - Strategy 3 (JSON fixing) integration:
```typescript
// Verify fixedJson values are properly unwrapped for map coercion
if (result.type === 'fixedJson') {
  // Extract the fixed value before map coercion
  return coerceValue(result.value, schema, newCtx);
}
```

#### 2. Quote Handling in Map Extraction
**File**: `jsonish/src/extractors.ts` (if exists) or relevant extraction logic
**Changes**: Improve quote handling in JSON extraction for maps

### Success Criteria:

**Automated verification**
- [ ] `bun test ./test/maps.test.ts` - Escaped quote tests pass
- [ ] `bun build` completes without errors
- [ ] No regressions in existing passing tests

**Manual Verification**
- [ ] Input `{""a"": ""b""}` returns `{ '"a"': '"b"' }`
- [ ] Complex escaped quotes in nested structures work correctly
- [ ] JSON fixing integration doesn't break other map scenarios

## Phase 2: Complex Nested Map Structure Fixes

### Overview
Fix parsing of multi-level nested map structures that currently fail completely.

### Root Cause Analysis
Complex nested maps (map of maps, maps in objects) fail due to recursive coercion issues or incomplete Value construction.

### Changes Required:

#### 1. Recursive Coercion Depth Handling
**File**: `jsonish/src/parser.ts`
**Changes**: Fix recursive map coercion in `coerceRecord()` function

**Lines 1421-1450** - Value coercion loop:
```typescript
// Ensure recursive coerceValue calls maintain proper context
for (const [key, val] of value.entries) {
  const coercedKey = coerceRecordKey(key, keySchema);
  const coercedValue = coerceValue(val, valueSchema, {
    ...ctx,
    depth: ctx.depth + 1,
    // Preserve circular reference detection
  });
  result[coercedKey] = coercedValue;
}
```

#### 2. Nested Value Construction
**File**: `jsonish/src/value.ts` or parser value creation
**Changes**: Ensure nested object Values are properly constructed

Verify that multi-level object structures create proper Value trees:
- Parent object Value → entries array
- Child object Value → nested entries array  
- Proper CompletionState propagation

### Success Criteria:

**Automated verification**
- [ ] `bun test ./test/maps.test.ts` - Nested map tests pass
- [ ] Map of maps: `z.record(z.record(z.string()))` works correctly
- [ ] Objects containing maps work correctly

**Manual Verification**
- [ ] Multi-level nesting (3+ levels) parses correctly
- [ ] Mixed object/map nesting maintains type coercion
- [ ] No infinite recursion or stack overflow issues

## Phase 3: Union Resolution Edge Case Fixes

### Overview
Fix union type resolution edge cases where map vs object discrimination fails.

### Root Cause Analysis
Union resolution occasionally picks wrong schema type despite existing 95 vs 100 point preference system.

### Changes Required:

#### 1. Union Scoring Refinement
**File**: `jsonish/src/parser.ts`
**Changes**: Enhance scoring logic in `calculateUnionScore()` function

**Lines 1375-1381** - Object vs Record scoring:
```typescript
// Add more nuanced scoring for object structure analysis
} else if (schema instanceof z.ZodObject) {
  if (value.type === 'object') {
    // Check if object structure matches schema fields
    const schemaKeys = Object.keys(schema.shape);
    const valueKeys = value.entries.map(([key, _]) => key);
    const exactMatch = schemaKeys.every(key => valueKeys.includes(key));
    score += exactMatch ? 100 : 90; // Prefer exact schema matches
  } else {
    score += 20;
  }
} else if (schema instanceof z.ZodRecord) {
  if (value.type === 'object') {
    score += 85; // Slightly lower than inexact object matches
  } else {
    score += 15;
  }
}
```

#### 2. Coercion Quality Assessment
**File**: `jsonish/src/parser.ts`
**Changes**: Track coercion success in union context

Add simple quality tracking without full flag system:
```typescript
// In coerceRecord function, return quality metadata
function coerceRecord<T extends z.ZodRecord<any>>(
  value: Value, 
  schema: T, 
  ctx: ParsingContext
): { result: z.infer<T>; quality: number } {
  // Return both result and quality score for union resolution
}
```

### Success Criteria:

**Automated verification**
- [ ] `bun test ./test/maps.test.ts` - Union resolution tests pass
- [ ] Object schemas properly preferred over map schemas when structure matches
- [ ] No incorrect type selection in union scenarios

**Manual Verification**
- [ ] Union of class and map chooses object for structured data
- [ ] Map schema selected when object structure doesn't match
- [ ] Edge cases with similar structures resolve correctly

## Phase 4: Error Recovery and Malformed JSON Improvements

### Overview
Improve error recovery for malformed map structures to handle edge cases gracefully.

### Root Cause Analysis
Some malformed JSON scenarios (unterminated strings, missing braces) don't recover properly in map context.

### Changes Required:

#### 1. Malformed Map Recovery
**File**: `jsonish/src/parser.ts` or fixing parser integration
**Changes**: Enhance error recovery in map parsing strategies

Ensure strategies 3-5 (JSON fixing, state machine, text extraction) work properly for maps:
- Trailing comma handling: `{"key": "value",}` 
- Missing closing braces: `{"key": "value"`
- Unterminated strings in map values

#### 2. Graceful Degradation
**File**: `jsonish/src/parser.ts`
**Changes**: Improve fallback behavior in `coerceRecord()`

**Lines 1500-1514** - Error handling:
```typescript
} catch (error) {
  // Better error recovery - try to return partial results
  if (partialResult && Object.keys(partialResult).length > 0) {
    return partialResult as z.infer<T>;
  }
  // Only fall back to empty record if no partial success
  return {} as z.infer<T>;
}
```

### Success Criteria:

**Automated verification**
- [ ] `bun test ./test/maps.test.ts` - All error recovery tests pass
- [ ] Malformed JSON edge cases handle gracefully
- [ ] No exceptions thrown for invalid input

**Manual Verification**
- [ ] Trailing commas handled correctly
- [ ] Partial maps extracted from incomplete JSON  
- [ ] Mixed content extraction works with malformed maps
- [ ] Reasonable fallback behavior for unparseable input

## Test Strategy

### Focused Test Execution
```bash
# Run map-specific tests during development
bun test ./test/maps.test.ts

# Run full suite to check for regressions
bun test

# Build verification
bun build
```

### Test Categories to Monitor
1. **Basic Maps** (8 tests) - Core functionality
2. **Dynamic Keys** (8 tests) - Key coercion and special characters
3. **Union Types** (2 tests) - Critical for proper type resolution
4. **Error Recovery** (8 tests) - Malformed input handling
5. **Nested Maps** (2 tests) - Complex recursive structures

### Regression Prevention
- Run full test suite after each phase
- Monitor test count: should remain at 65 total scenarios
- Verify no new test failures in other modules

## Performance Considerations
- Maintain existing O(n) complexity for map parsing
- No additional memory overhead from bug fixes
- Preserve streaming/partial parsing capabilities

## Migration Notes
- No breaking changes to existing API
- All fixes are internal to parsing logic
- Existing map parsing code continues to work

## References 
* Original requirements: `specifications/08-map-record-parsing/feature.md`
* Research analysis: `specifications/08-map-record-parsing/research/research_2025-08-26_20-40-53_map-record-parsing-implementation.md`
* Test suite: `test/maps.test.ts`
* Current implementation: `jsonish/src/parser.ts:1394-1514`
* Union scoring: `jsonish/src/parser.ts:1375-1381`