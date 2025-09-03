---
date: 2025-09-03T15:19:33-05:00
researcher: Claude Code Assistant
git_commit: 8b448e9196e9cf7a09a987b41ca8f8144f5627a5
branch: master
repository: jsonish
topic: "Recursive Union Cache Scoping Implementation - Partial Progress"
tags: [implementation, cache-scoping, recursive-unions, per-session-caches, architecture-fix]
status: work_in_progress
last_updated: 2025-09-03
last_updated_by: Claude Code Assistant
type: implementation_strategy
---

# Handoff: Recursive Union Cache Scoping Implementation - Partial Progress

## Task(s)

### Primary Task: Fix Global Cache Scope Issue (IN PROGRESS)
- **Status**: 🔄 Partially Complete - Root cause identified and architecture partially implemented
- **Objective**: Move union resolution caches from global module scope to per-parsing-session scope
- **Critical Discovery**: Found the actual root cause - global caches persist across test runs and parsing sessions, causing cache contamination

### Secondary Task: Complete Cache Reference Updates (PENDING)
- **Status**: ⏳ Pending - Multiple functions still reference old global cache variables
- **Objective**: Update all union resolution functions to use session-scoped caches
- **Scope**: ~15 cache access points across multiple functions need updating

## Recent Changes

### Cache Architecture Restructure (PARTIAL)
- **Primary Change**: Moved cache definitions from global scope to `ParsingContext`
- **Files Modified**: `jsonish/src/parser.ts`
  - Updated `ParsingContext` interface (`line 1070-1078`) to include per-session caches
  - Updated `createParsingContext()` function (`line 1081-1091`) to create fresh cache instances
  - Removed global cache variables (`line 8-14`) except `lazySchemaCache`

### Function Updates (INCOMPLETE)
- **Completed**: Updated main `coerceUnion` function to use `ctx.unionResultCache`, `ctx.scoreCache`, `ctx.recursionStack`
- **Completed**: Updated `calculateUnionScoreOptimized` function signature and implementation
- **Incomplete**: ~15 other cache access points still reference old global variables

## Learnings

### Root Cause Discovery: Global Cache Persistence
- **Critical Insight**: The original failing behavior was caused by **global module-level caches** persisting across:
  1. Multiple test runs within the same test suite
  2. Different parsing sessions
  3. Different recursive contexts within the same parsing
- **Evidence**: Test passes when run in isolation but fails when run with other tests
- **Cache Contamination Pattern**: Union results from one schema context contaminate different schema contexts

### Architecture Analysis
- **Cache Locations Identified**: 
  - `unionResultCache` - stores union resolution results with TTL
  - `scoreCache` - caches scoring calculations for performance
  - `recursionStack` - tracks recursion depth to prevent infinite loops
- **Session Boundary**: Caches should reset at each `parseBasic()` call, not persist globally
- **Context Propagation**: All union resolution functions need access to session context

### Implementation Challenges Discovered
- **Widespread Cache Usage**: Cache references are scattered across ~6 different union resolution functions
- **Function Signature Updates**: Many functions need context parameter added
- **Interdependency Complexity**: Functions call each other with varying context access patterns

## Artifacts

### Modified Files
- **Primary Implementation**: `jsonish/src/parser.ts`
  - Lines 1070-1078: Updated `ParsingContext` interface with session caches
  - Lines 1081-1091: Updated `createParsingContext()` to create fresh caches
  - Lines 2293-2556: Updated main `coerceUnion()` function for session-scoped caches
  - Lines 2189-2259: Updated `calculateUnionScoreOptimized()` function signature

### Reference Documents
- **Previous Handoff**: `specifications/recursive-union-parsing/handoffs/handoff_2025-09-03_10-55-53_recursive-union-bug-comprehensive-analysis.md`
  - Contains comprehensive root cause analysis and implementation strategy
  - Documents the original 4 architectural issues and fix approach
- **Original Research**: Earlier handoff documents in same directory tree

## Action Items & Next Steps

### Immediate Priority: Complete Cache Reference Updates
1. **Update All Global Cache References**: Search and replace remaining `unionResultCache`, `scoreCache`, `recursionStack` references with `ctx.` prefixed versions
   - **Command**: `grep -n "unionResultCache\|scoreCache\|recursionStack" jsonish/src/parser.ts | grep -v "ctx\."`
   - **Estimated**: ~15 references across multiple functions need updating
   - **Critical Functions**: Functions that don't currently accept `ParsingContext` parameter need signature updates

2. **Update Function Signatures**: Add `ctx: ParsingContext` parameter to functions that access caches
   - Functions likely needing updates: `coerceUnionHybrid`, `coerceWithVisitorOptimization`, and others
   - **Pattern**: Follow the example of `calculateUnionScoreOptimized()` signature update

3. **Update Function Calls**: Ensure all calls to updated functions pass context parameter
   - **Risk**: Missing context parameter will cause compilation errors
   - **Strategy**: Use TypeScript compiler to identify all call sites needing updates

### Testing & Validation
4. **Test Core Fix**: Run specific recursive union test after completing cache updates
   - **Command**: `bun test test/class.test.ts -t "should parse complex recursive structure"`
   - **Success Criteria**: Numbers `1` and `2` preserved as numbers, not converted to booleans

5. **Regression Testing**: Run full test suite to ensure no new failures
   - **Command**: `bun run tests`
   - **Baseline**: Should maintain or improve from current 35 failing tests

### Alternative Approach (If Needed)
6. **Session Cache Binding**: If updating all functions proves complex, consider alternative approach:
   - Bind global cache variables to session caches at start of `parseBasic()`
   - Reset global variables to session-specific instances per parse
   - **Example**: `unionResultCache = ctx.unionResultCache;` at start of parsing

## Other Notes

### Current Test Status
- **Failing Test**: `test/class.test.ts:946-996` - "should parse complex recursive structure"
- **Symptom**: Numbers `1` and `2` convert to booleans `true` and `false` in deep recursive contexts
- **Isolation Behavior**: Test passes when run individually, fails in test suite (confirms cache contamination)

### Cache Implementation Context
- **Cache TTL**: Union result cache uses 10-second TTL - appropriate for session scope
- **Recursion Protection**: 25-depth limit prevents infinite loops in recursive schemas
- **Performance Impact**: Session-scoped caches may slightly reduce cache hit rates but eliminate contamination

### Implementation Patterns
- **Context Propagation**: `ParsingContext` already exists and is properly passed through most parsing functions
- **Cache Key Structure**: Enhanced schema fingerprinting implemented in previous work should prevent collisions
- **Two-Phase Resolution**: Exact match phase already re-enabled and working

### File References for Continuation
- **Main Implementation**: `jsonish/src/parser.ts` - contains all union resolution logic
- **Test Validation**: `test/class.test.ts:946-996` - primary failing test case
- **Context Interface**: `jsonish/src/parser.ts:1070-1078` - `ParsingContext` definition
- **Entry Point**: `jsonish/src/parser.ts:23` - `parseBasic()` function where session begins

### Risk Assessment
- **High Confidence**: Root cause correctly identified - global cache scope is definitely the issue
- **Medium Risk**: Function signature updates may introduce compilation errors requiring cascading fixes
- **Low Risk**: Core architecture changes already implemented correctly