---
date: 2025-09-03T10:52:44-05:00
researcher: Claude Code Assistant  
git_commit: 04b8578c45074179125fb76281709096c36930ac
branch: master
repository: jsonish
topic: "Recursive Union Parsing Bug Implementation State Analysis"
tags: [research, codebase, parser, union-resolution, recursive-types, cache-collisions, type-coercion, bug-analysis]
status: complete
last_updated: 2025-09-03
last_updated_by: Claude Code Assistant
type: research
---

# Research: Recursive Union Parsing Bug Implementation State Analysis

**Date**: 2025-09-03T10:52:44-05:00  
**Researcher**: Claude Code Assistant  
**Git Commit**: 04b8578c45074179125fb76281709096c36930ac  
**Branch**: master  
**Repository**: jsonish

## Research Question

Thoroughly analyze the current state of the JSONish implementation and the recursive union parsing bug we are working on fixing, based on recent handoffs and commits, to understand what needs to be implemented.

## Summary

The JSONish parser has a critical bug where numbers `1` and `2` are incorrectly converted to booleans `true` and `false` in deeply nested recursive union structures. This affects the test "should parse complex recursive structure" in `test/class.test.ts:946-996`. Through comprehensive analysis of the codebase and recent handoffs, I've identified that this is **not** a simple coercion issue, but rather a complex interaction between four architectural problems:

1. **Cache key collisions** between different union contexts
2. **Missing two-phase resolution** (exact match → coercion)  
3. **Inverted scoring philosophy** (reward vs penalty based)
4. **Recursion fallback bypassing schema validation**

Previous attempts to fix this issue caused major regressions (53 failing tests vs original 34), indicating the high complexity and interdependency of the parser systems.

## Detailed Findings

### Current Bug Status

**Test Location**: `test/class.test.ts:946-996` - "Objects > Recursive Objects > should parse complex recursive structure"  
**Issue**: Numbers `1` and `2` at `rec_two.rec_one.rec_one.rec_one` and `rec_two.rec_one.rec_one.rec_two` are converted to booleans `true` and `false`  
**Current Test Status**: 34 failing tests (confirmed by `bun run tests`)  
**Schema**: `z.union([z.lazy(() => schema), z.number(), z.boolean()])`  

### Union Resolution System Analysis

#### Cache Key Generation Problem
**File**: `jsonish/src/parser.ts:1873-1876`
```typescript
function createEfficientCacheKey(value: Value, schema: z.ZodType): string {
  return `${schema.constructor.name}:${getValueHash(value)}`;
}
```

**Critical Issue**: Different union schemas with same value type generate identical cache keys:
- `z.union([z.number(), z.boolean()])` → `"ZodUnion:number:1"`  
- `z.union([z.boolean(), z.number(), z.null()])` → `"ZodUnion:number:1"`

This causes cache pollution where results from one union context contaminate different union contexts.

#### Union Coercion Flow
**Main Entry**: `coerceValue()` (line 1121) → `coerceUnion()` (line 2259)  
**Recursion Limit**: 25 depth limit (line 2276) with fallback to `coerceValueGeneric()`  
**Scoring System**: Lines 2701-2856 with bonus-based scoring (higher is better)

#### Missing Two-Phase Resolution
**Current State**: Direct coercion without exact-match phase  
**Evidence**: Line 2330 shows "Fast path disabled for debugging" - the exact match phase is **disabled**  
**Rust Pattern**: `try_cast` (exact only) → `coerce` (with penalties) → `pick_best`

### Type Coercion System Analysis  

#### Number-to-Boolean Conversion Path
**File**: `jsonish/src/coercer.ts:49-59`
```typescript
export function coerceToBoolean(value: Value, schema: z.ZodBoolean): boolean {
  switch (value.type) {
    case 'number':
      return value.value !== 0;  // 1 → true, 2 → false (!!)
  }
}
```

**Problem**: Immediate conversion using JavaScript truthiness without considering semantic appropriateness or union context.

#### Scoring Philosophy Issue
**Current (TypeScript)**: "Higher is better" - exact matches get 100 points, coercions also get 100+ points  
**Rust Original**: "Lower is better" - exact matches get 0 penalty, coercions get +1 to +110 penalties  
**Impact**: TypeScript rewards inappropriate cross-type coercions equally to exact matches

### Architecture Flow Analysis

#### Complete Data Pipeline
1. **Raw Input** → `parseBasic()` (`parser.ts:23`)
2. **Strategy Cascade**:
   - Early string priority (lines 47-49)
   - Standard JSON parsing (lines 67-73) → `JSON.parse()` → `createValueFromParsed()`
   - Mixed content extraction (lines 76-386) → `extractJsonFromText()`
   - Error recovery (lines 388-409) → `fixJson()` → state machine
3. **Value Creation** → Internal `Value` types (`value.ts`)
4. **Schema Matching** → `coerceValue()` dispatch (lines 1086-1191)
5. **Union Resolution** → `coerceUnion()` with caching/scoring (lines 2259-2490)
6. **Final Coercion** → Type-specific coercers (`coercer.ts`)

#### Recursion Fallback Problem  
**Location**: `jsonish/src/parser.ts:2070-2091`
```typescript
if (currentDepth >= 25) {
  return coerceValueGeneric(value) as z.infer<T>; // Bypasses schema validation!
}
```
**Impact**: Deep nesting triggers schema-unaware coercion, causing object flattening and type confusion.

### Test Pattern Analysis

#### Working Cases
- **Simple unions**: `z.union([z.number(), z.boolean()])` correctly preserves numbers
- **Shallow recursion**: 1-2 levels deep work correctly
- **Single union branch**: Terminal values only (no recursive nesting)

#### Failing Cases  
- **Complex recursive**: `z.union([z.lazy(() => schema), z.number(), z.boolean()])`
- **Deep recursion**: 3+ levels with multiple union branches
- **Multiple union branches**: `rec_one` + `rec_two` both have unions at same depth

### Previous Implementation Attempts

Based on handoff `specifications/recursive-union-parsing/handoffs/handoff_2025-08-28_17-25-48_recursive-union-implementation-failure-analysis.md`:

**Status**: **Failed** - All changes were reverted via `git restore jsonish/src/parser.ts`  
**Attempted Changes**:
1. Major architectural rewrite with two-phase union resolution system
2. Minimal cache key fix to include union option types  
**Impact**: Initial changes caused 53 failing tests (vs original 34), breaking basic functionality

**Key Learning**: Sweeping architectural changes are high-risk; incremental, targeted fixes required.

## Code References

- `jsonish/src/parser.ts:1873-1876` - Cache key generation (main issue location)
- `jsonish/src/parser.ts:2259-2490` - Union resolution system  
- `jsonish/src/parser.ts:2276-2295` - Recursion fallback logic
- `jsonish/src/parser.ts:2701-2856` - Scoring system
- `jsonish/src/coercer.ts:49-59` - Boolean coercion (symptom, not root cause)
- `test/class.test.ts:946-996` - Failing test case
- `jsonish/src/value.ts:3-12` - Internal value representation

## Parser Flow

**Detailed Trace for Failing Test Case**:
1. **Input**: `{ rec_two: { rec_one: { rec_one: { rec_one: 1, rec_two: 2 } } } }`
2. **Parsing**: Standard JSON parsing → `createValueFromParsed()` → nested `Value` objects  
3. **Schema Matching**: Recursive `coerceValue()` calls for nested union schemas
4. **Cache Key Generation**: `createEfficientCacheKey()` creates identical keys for different union contexts  
5. **Union Resolution**: `coerceUnion()` with recursion depth tracking
6. **Cache Pollution**: Results from boolean-first union context contaminate number-first context  
7. **Type Conversion**: Numbers converted using boolean coercion logic (`1 → true`, `2 → false`)
8. **Result**: Expected numbers become booleans at specific nesting depths

## Architecture Insights

### Rust vs TypeScript Implementation Gaps

**Rust Strengths** (from `baml/engine/baml-lib/jsonish/src/deserializer/`):
- **Penalty-based scoring**: Lower scores preferred, exact matches = 0 penalty
- **Strict type boundaries**: `try_cast` prevents cross-type coercion unless no exact matches  
- **Context isolation**: No global cache collisions between different schemas
- **Controlled recursion**: Proper circular reference detection without schema bypass

**TypeScript Gaps**:
- **Bonus-based scoring**: Higher scores preferred, rewards successful coercion
- **Immediate coercion**: No strict type matching phase before attempting conversions
- **Cache contamination**: Schema-agnostic caching causes cross-contamination  
- **Recursion bypass**: Generic fallback loses schema context

### Critical Fix Requirements

Based on handoff analysis and architecture research:

1. **Enhanced Cache Keys**: Include union option types/fingerprints to prevent collisions
2. **Two-Phase Union Resolution**: Implement exact match phase before coercion attempts
3. **Penalty-Based Scoring**: Invert scoring system to match Rust implementation (lower is better)
4. **Schema-Aware Recursion**: Replace generic fallback with schema-aware depth limiting
5. **Context Separation**: Isolate cache entries for different union contexts

## Related Documentation

- `CLAUDE.md` - JSONish development guidelines and TDD approach
- `specifications/recursive-union-parsing/handoffs/handoff_2025-08-28_16-38-25_recursive-union-number-boolean-conversion-fix.md` - Detailed fix strategy
- `specifications/recursive-union-parsing/research/research_2025-08-28_16-34-40_recursive-union-number-boolean-conversion.md` - Original root cause analysis

## Open Questions

1. **Performance Impact**: How will two-phase resolution and schema fingerprinting affect parsing speed?
2. **Memory Usage**: Will enhanced cache keys increase memory consumption significantly?
3. **Compatibility**: Could scoring system changes affect other union resolution scenarios?
4. **Incremental Approach**: What's the minimal set of changes that can fix the issue without causing regressions?

## Implementation Recommendations

### Phase 1: Minimal Critical Fixes
1. **Fix cache key generation** to include schema fingerprinting  
2. **Enable exact match phase** in union resolution (currently disabled)
3. **Add strict type boundaries** to prevent inappropriate coercions

### Phase 2: Architecture Improvements  
1. **Implement penalty-based scoring** system
2. **Add schema-aware recursion fallback**
3. **Separate caching systems** for different concerns

### Testing Strategy
- **TDD Approach**: Run `bun test -t "should parse complex recursive structure"` after each change
- **Regression Prevention**: Run `bun run tests` frequently to ensure no new failures  
- **Incremental Validation**: Make minimal, targeted changes rather than architectural rewrites

The research confirms this is a high-complexity issue requiring deep parser architecture understanding, with proven high regression risk from sweeping changes. The fix requires careful, incremental improvements focused on cache key generation, union context separation, and two-phase resolution implementation.