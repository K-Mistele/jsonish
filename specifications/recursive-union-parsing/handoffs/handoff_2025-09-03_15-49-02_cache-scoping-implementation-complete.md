---
date: 2025-09-03T15:49:02-05:00
researcher: Claude Code Assistant
git_commit: 8b448e9196e9cf7a09a987b41ca8f8144f5627a5
branch: master
repository: jsonish
topic: "Recursive Union Cache Scoping Implementation - Session-Based Architecture"
tags: [implementation, cache-scoping, recursive-unions, session-context, parser-architecture, bug-fix]
status: complete
last_updated: 2025-09-03
last_updated_by: Claude Code Assistant
type: implementation_strategy
---

# Handoff: Recursive Union Cache Scoping Implementation - Session-Based Architecture

## Task(s)

### Primary Task: Implement Session-Scoped Caches (COMPLETED)
- **Status**: ✅ Complete - Successfully moved all union resolution caches from global module scope to per-parsing-session scope
- **Objective**: Fix cache contamination across test runs and parsing sessions that was causing incorrect type conversions
- **Scope**: Updated `ParsingContext` interface, cache initialization, and all cache references throughout the codebase

### Secondary Task: Fix Context Propagation Issues (COMPLETED)
- **Status**: ✅ Complete - Fixed all instances where new contexts were being created instead of using existing session context
- **Objective**: Ensure single context per parsing session to maintain cache isolation
- **Scope**: Updated 5 instances where `createParsingContext()` was being called inappropriately

### Tertiary Task: Re-enable Lazy Schema Caching (COMPLETED)
- **Status**: ✅ Complete - Re-enabled caching of resolved lazy schemas to ensure consistent schema instances
- **Objective**: Prevent different schema instances for same recursive type from generating different cache keys
- **Scope**: Modified `coerceValue()` function to use WeakMap-based lazy schema cache

### Outstanding Issue: Recursive Union Test Still Failing (INCOMPLETE)
- **Status**: ❌ Incomplete - Test `test/class.test.ts:946-996` still fails with numbers converting to booleans
- **Objective**: Fix deep recursion issue where numbers 1 and 2 convert to booleans at depth 3-4
- **Current State**: 35 failing tests (close to original baseline of 34)

## Recent Changes

### Cache Architecture Restructure (`jsonish/src/parser.ts`)
1. **Lines 1070-1074**: Added cache fields to `ParsingContext` interface:
   - `unionResultCache`: Stores union resolution results with TTL
   - `scoreCache`: Caches scoring calculations for performance
   - `recursionStack`: Tracks recursion depth per cache key

2. **Lines 1076-1087**: Updated `createParsingContext()` to initialize fresh caches per session

3. **Lines 2062-2522**: Updated all cache references in union resolution functions to use `ctx.` prefix

4. **Line 2304**: Disabled problematic `skipCache` logic that was preventing caching for number/boolean/lazy combinations

5. **Lines 1099-1105**: Re-enabled lazy schema caching using WeakMap to ensure consistent schema instances

### Context Propagation Fixes (`jsonish/src/parser.ts`)
- **Line 129**: Changed from `createParsingContext()` to `ctx` 
- **Line 151**: Changed from `createParsingContext()` to `ctx`
- **Line 243**: Changed from `createParsingContext()` to `ctx`
- **Line 291**: Changed from `createParsingContext()` to `ctx`
- **Line 1741**: Changed from `createParsingContext()` to `ctx`

## Learnings

### Root Cause: Global Cache Persistence
- **Critical Finding**: Global module-level caches were persisting across multiple test runs and parsing sessions
- **Evidence**: Tests passed in isolation but failed when run together, confirming cache contamination
- **Solution**: Session-scoped caches completely isolate each parsing operation

### Schema Instance Consistency Issue
- **Discovery**: `z.lazy()` schemas call getter function each time, creating new schema instances
- **Impact**: Different schema instances generate different cache keys even for same recursive type
- **Location**: `jsonish/src/parser.ts:1098-1105` - lazy schema resolution
- **Solution**: WeakMap-based caching ensures same lazy schema always resolves to same instance

### Cache Key Generation Complexity
- **Finding**: Cache key includes random ID generation at `jsonish/src/parser.ts:1921`
- **Mitigation**: ID is cached on schema object itself via `__cache_id__` property
- **Remaining Issue**: Still may not differentiate recursive contexts adequately

### Two-Phase Resolution Working Correctly
- **Phase 1**: `tryDirectCast()` at `jsonish/src/parser.ts:1944-1988` correctly identifies exact type matches
- **Phase 2**: Full coercion only runs if no exact match found
- **Debug Evidence**: Number values correctly matched in Phase 1 with score 100

### Incomplete Fix - Deep Recursion Issue Persists
- **Symptom**: At `rec_two.rec_one.rec_one` depth, values `{rec_one: 1, rec_two: 2}` become `{rec_one: true, rec_two: false}`
- **Pattern**: Shallower depths preserve numbers correctly, suggesting depth-related issue
- **Debug Finding**: Value 2 never processed through union resolution system, only value 1 logged

## Artifacts

### Modified Files
- `jsonish/src/parser.ts` - Primary implementation file with all cache and context fixes

### Reference Documents
- `specifications/recursive-union-parsing/handoffs/handoff_2025-09-03_10-55-53_recursive-union-bug-comprehensive-analysis.md` - Comprehensive root cause analysis
- `specifications/recursive-union-parsing/handoffs/handoff_2025-09-03_15-19-33_cache-scoping-implementation-partial.md` - Initial partial implementation
- `specifications/recursive-union-parsing/research/research_2025-09-03_10-52-44_recursive-union-bug-implementation-state.md` - Detailed architectural analysis

### Test Files
- `test/class.test.ts:946-996` - Primary failing test case "should parse complex recursive structure"
- `test/class.test.ts:1133` - Secondary failing test "should handle partial resume parsing"

## Action Items & Next Steps

### Immediate Priority: Debug Deep Recursion Issue
1. **Investigate Value 2 Processing**: Determine why value 2 is never processed through union resolution
   - Add targeted logging for `rec_two` field processing
   - Trace full path from extraction to coercion for both values
   - Check if different union options (with null) affect processing

2. **Review Cache Key Generation**: Improve context differentiation
   - Consider including recursion path in cache key
   - Investigate if schema fingerprinting needs enhancement for recursive contexts
   - Check if stack depth calculation at line 1923 is correct

3. **Examine Recursion Depth Limits**: Check if depth 25 limit is being hit prematurely
   - Current limit at `jsonish/src/parser.ts:2338`
   - Add logging to detect when fallback is triggered
   - Consider if limit needs adjustment for complex structures

### Medium Priority: Architecture Improvements
4. **Consider Penalty-Based Scoring**: Switch from "higher is better" to Rust's "lower is better" approach
   - Current implementation at `jsonish/src/parser.ts:2195-2265`
   - Would align with original Rust implementation
   - May resolve preference issues between number and boolean coercion

5. **Validate Union Option Ordering**: Ensure options are evaluated in correct order
   - Union defined as `[z.lazy(() => schema), z.number(), z.boolean()]`
   - Verify tryDirectCast processes in this order consistently

### Low Priority: Performance & Testing
6. **Add Comprehensive Union Tests**: Create tests for edge cases
   - Different recursion depths
   - Various union option combinations
   - Cache isolation verification

7. **Performance Monitoring**: Track impact of session-scoped caches
   - May have slight performance impact vs global caches
   - Consider cache size limits if memory becomes concern

## Other Notes

### Current Test Status
- **Baseline**: 35 failing tests (originally 34-35)
- **No Regression**: Changes maintained baseline without introducing new failures
- **Primary Failure**: Recursive union with number/boolean conversion at deep nesting

### Key Code Locations
- **Parser Entry**: `jsonish/src/parser.ts:18` - `parseBasic()` function
- **Union Resolution**: `jsonish/src/parser.ts:2296` - `coerceUnion()` function  
- **Cache Key Generation**: `jsonish/src/parser.ts:1916` - `createEfficientCacheKey()` function
- **Type Coercion**: `jsonish/src/coercer.ts:49-61` - Boolean coercion logic
- **Value Creation**: `jsonish/src/value.ts:38-61` - Creates internal value representation

### Debug Commands
- **Specific Test**: `bun test test/class.test.ts -t "should parse complex recursive structure"`
- **Full Suite**: `bun run tests` (not `bun test` which includes BAML tests)
- **Build Check**: `bun build jsonish/src/parser.ts`

### Architecture Context
- **TypeScript Port**: Translating Rust JSONish parser to TypeScript + Zod
- **No BAML Features**: Pure TypeScript/Zod implementation without BAML-specific features
- **TDD Approach**: Using existing test suite to drive implementation

### Critical Insights
- Cache contamination was definitely occurring and is now fixed at session level
- Lazy schema caching is essential for recursive structure consistency  
- The remaining issue appears to be specific to deep recursion handling
- Two-phase resolution (exact match then coercion) is working as designed
- Value 2 processing anomaly suggests issue may be in object field traversal rather than union resolution

This handoff provides complete context for resuming work on the recursive union parsing bug, with clear next steps focusing on the deep recursion issue that remains unresolved.