---
date: 2025-08-28T17:25:48-05:00
researcher: Claude Code Assistant
git_commit: 04b8578c45074179125fb76281709096c36930ac
branch: master
repository: jsonish
topic: "Recursive Union Parsing Implementation Attempt and Failure Analysis"
tags: [implementation, recursive-unions, regressions, cache-collisions, two-phase-resolution]
status: incomplete
last_updated: 2025-08-28
last_updated_by: Claude Code Assistant
type: implementation_strategy
---

# Handoff: Recursive Union Parsing Fix Implementation Attempt

## Task(s)
**Primary Task**: Fix the failing test "should parse complex recursive structure" in `test/class.test.ts:946-996` where numbers `1` and `2` in deeply nested recursive structures are incorrectly converted to booleans `true` and `false`.

**Status**: **Failed** - Attempted implementation caused major regressions and did not resolve the core issue.

**Test Details**:
- Location: `test/class.test.ts:946-996` 
- Test name: `Objects > Recursive Objects > should parse complex recursive structure`
- Issue: In nested recursive union structures, `rec_two.rec_one.rec_one.rec_one: 1` becomes `true` and `rec_two.rec_one.rec_one.rec_two: 2` becomes `false`
- Schema: Recursive object with `z.union([z.lazy(() => schema), z.number(), z.boolean()])`

## Recent Changes
**All changes were reverted** - No permanent changes remain in the codebase.

**Attempted Changes** (reverted via `git restore jsonish/src/parser.ts`):
1. **Major architectural rewrite attempt**: Implemented two-phase union resolution system, new cache key generation, exact match phase, penalty-based scoring
2. **Minimal cache key fix attempt**: Modified `createEfficientCacheKey()` in `jsonish/src/parser.ts:1873-1876` to include union option types

**Impact**: Initial sweeping changes caused 53 failing tests (vs original 34), breaking basic functionality across aliases, unions, objects, and streaming tests.

## Learnings

### Root Cause Complexity
- **Not a simple coercion issue**: The problem is NOT simply `coerceToBoolean()` in `jsonish/src/coercer.ts:49-59` converting numbers to booleans
- **Context-specific failure**: Simple unions work correctly (`z.union([z.number(), z.boolean()])` preserves number types), but deeply nested recursive structures fail
- **Cache pollution suspected**: Same recursive structure processes correctly at some depths but fails at others, suggesting cache key collisions between different union contexts

### Technical Insights
- **Mixed content vs pure JSON**: Issue occurs with both pure JSON input and mixed content extraction, ruling out extraction-specific problems
- **Structural parsing issues**: Test results show not just type conversion but also structural flattening/parsing problems
- **Recursive depth sensitivity**: Problem appears at specific nesting levels in recursive structures

### Implementation Architecture Required
Based on handoff document `specifications/recursive-union-parsing/handoffs/handoff_2025-08-28_16-38-25_recursive-union-number-boolean-conversion-fix.md`, the fix requires:
- Two-phase union resolution (exact match then coercion)
- Improved cache key generation with schema fingerprinting  
- Penalty-based scoring system (lower scores = better matches)
- Schema-aware recursion fallbacks

## Artifacts
- **Handoff Document**: `specifications/recursive-union-parsing/handoffs/handoff_2025-08-28_16-38-25_recursive-union-number-boolean-conversion-fix.md` - Detailed analysis of the issue and proposed solution
- **Research Document**: `specifications/recursive-union-parsing/research/research_2025-08-28_16-34-40_recursive-union-number-boolean-conversion.md` - Root cause analysis
- **Debug Scripts Created** (temporary):
  - `debug-union.js` - Simple union testing
  - `debug-detailed.js` - Mixed content vs pure JSON comparison  
  - `debug-recursive-depth.js` - Depth-based testing
  - `debug-mixed-types.js` - Reproduced the exact failing case
  - `debug-simple.js` - Basic union behavior verification

## Action Items & Next Steps

### Immediate Priority
1. **Study the existing handoff document thoroughly** before attempting any implementation
2. **Understand the parser architecture deeply** - The issue involves complex interactions between:
   - JSON extraction (`jsonish/src/extractors.ts`) 
   - Union resolution (`jsonish/src/parser.ts:1120-1122` dispatch)
   - Caching mechanisms (`jsonish/src/parser.ts:1873-1876`)
   - Recursive depth handling

### Implementation Strategy  
1. **Incremental approach**: Make minimal, targeted changes rather than architectural rewrites
2. **Test-driven development**: Run `bun test -t "should parse complex recursive structure"` after each small change
3. **Regression prevention**: Run `bun run tests` frequently to ensure no new failures
4. **Focus on cache key generation first**: The minimal fix attempt suggests this may be the easiest entry point

### Specific Code Areas
- **Cache key function**: `jsonish/src/parser.ts:1873-1876` - `createEfficientCacheKey()` 
- **Union dispatch**: `jsonish/src/parser.ts:1120-1122` - Main entry point for union processing
- **Boolean coercion**: `jsonish/src/coercer.ts:49-59` - But likely not the root cause
- **Union resolution**: `jsonish/src/parser.ts` - Multiple `coerceUnion*` functions

## Other Notes

### Testing Approach
- **Failing test baseline**: 34 failing tests originally (confirmed via `bun run tests`)
- **Specific test command**: `bun test -t "should parse complex recursive structure"`
- **Debug methodology**: Simple unions work, complex nested recursive structures fail

### Risk Assessment
- **High complexity**: This issue requires deep parser architecture understanding
- **High regression risk**: Proven by my 53-test failure when attempting sweeping changes  
- **Codebase stability**: Many interdependent systems that can break with seemingly minor changes

### Key File Locations
- Main parser: `jsonish/src/parser.ts`
- Coercion logic: `jsonish/src/coercer.ts`  
- Extraction logic: `jsonish/src/extractors.ts`
- Test location: `test/class.test.ts:946-996`

**Recommendation**: This requires a parser architecture expert with deep understanding of the existing union resolution system. Avoid sweeping changes; focus on incremental, well-tested improvements.