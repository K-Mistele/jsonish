---
date: 2025-09-03T10:55:53-05:00
researcher: Claude Code Assistant
git_commit: 04b8578c45074179125fb76281709096c36930ac
branch: master
repository: jsonish
topic: "Recursive Union Bug Comprehensive Analysis and Implementation Strategy"
tags: [implementation, strategy, recursive-unions, cache-collisions, two-phase-resolution, type-coercion, streaming-partial-parsing, architectural-analysis]
status: complete
last_updated: 2025-09-03
last_updated_by: Claude Code Assistant
type: implementation_strategy
---

# Handoff: Recursive Union Bug Comprehensive Analysis and Implementation Strategy

## Task(s)

### Primary Task: Comprehensive Bug Analysis (COMPLETED)
- **Status**: ✅ Complete - Thorough analysis of recursive union parsing bug through parallel codebase research
- **Objective**: Understand current implementation state and bug(s) based on recent handoffs and commits
- **Scope**: Analyzed parser architecture, union resolution system, type coercion flow, and test patterns

### Secondary Task: Implementation Planning (COMPLETED)  
- **Status**: ✅ Complete - Detailed implementation strategy documented with specific file locations and fix priorities
- **Objective**: Create actionable implementation plan based on architectural analysis and previous failed attempts
- **Scope**: Identified four root causes, prioritized fix phases, and established regression prevention approach

### Discovery Task: Additional Streaming Bug Identified (DISCOVERED)
- **Status**: 🆕 Newly Identified - Found second failing test during analysis
- **Test**: `test/class.test.ts:1133` - "Objects > Streaming/Partial Parsing > should handle partial resume parsing"
- **Issue**: `ZodError: Invalid input: expected object, received string`
- **Relationship**: May be related to same cache collision issue or separate streaming parser problem

## Recent Changes

### Research Artifacts Created
- **No code changes made** - Research and analysis phase only
- **Primary Research Document**: Created comprehensive analysis at `specifications/recursive-union-parsing/research/research_2025-09-03_10-52-44_recursive-union-bug-implementation-state.md`
- **All analysis based on existing codebase state** - No modifications to preserve current failing test baseline

### Key Discoveries Made
- **Confirmed 34 failing tests baseline** via `bun run tests` execution
- **Identified dual test failures**: Recursive union bug + streaming/partial parsing issue  
- **Traced complete architectural flow** from input to union resolution failure
- **Located exact bug manifestation points** in cache key generation and union scoring

## Learnings

### Root Cause Analysis: Four Interconnected Architectural Issues

#### 1. **Cache Key Collision Problem** (`jsonish/src/parser.ts:1873-1876`)
```typescript
function createEfficientCacheKey(value: Value, schema: z.ZodType): string {
  return `${schema.constructor.name}:${getValueHash(value)}`;
}
```
- **Critical Issue**: Different union schemas with identical values generate same cache keys
- **Example**: `z.union([z.number(), z.boolean()])` and `z.union([z.boolean(), z.number(), z.null()])` both produce `"ZodUnion:number:1"`
- **Impact**: Cache results from one union context contaminate different union contexts
- **Evidence**: Deep recursive structures trigger cache hits from wrong schema contexts

#### 2. **Missing Two-Phase Resolution** (`jsonish/src/parser.ts:2330`)
- **Current State**: Exact match phase is **disabled** ("Fast path disabled for debugging")
- **Rust Pattern**: `try_cast` (exact only) → `coerce` (with penalties) → `pick_best`
- **TypeScript Issue**: Direct coercion without exact-match phase first
- **Impact**: Numbers immediately get converted to booleans instead of exact number match being tried first

#### 3. **Inverted Scoring Philosophy** (`jsonish/src/parser.ts:2496-2665`)
- **TypeScript Current**: "Higher is better" scoring - exact matches get 100 points, coercions also get 100+ points
- **Rust Original**: "Lower is better" penalty system - exact matches get 0, coercions get +1 to +110 penalties  
- **Impact**: TypeScript rewards inappropriate cross-type coercions equally to exact matches
- **Evidence**: `calculateUnionScore()` gives boolean coercion from number 100+ points vs Rust's +1 penalty

#### 4. **Recursion Fallback Schema Bypass** (`jsonish/src/parser.ts:2070-2091`)
```typescript
if (currentDepth >= 25) {
  return coerceValueGeneric(value) as z.infer<T>; // Bypasses schema validation!
}
```
- **Problem**: Deep nesting triggers schema-unaware coercion
- **Impact**: Complex recursive structures lose type information and get improperly coerced
- **Test Evidence**: Failing test reaches this fallback, causing object flattening and type confusion

### Architectural Flow Analysis

#### Complete Data Pipeline Traced
1. **Raw Input** → `parseBasic()` (`jsonish/src/parser.ts:23`)
2. **Strategy Cascade**: Early string priority → Standard JSON parsing → Mixed content extraction → Error recovery
3. **Value Creation** → Internal `Value` types (`jsonish/src/value.ts:3-12`)
4. **Union Resolution** → `coerceUnion()` with caching/scoring (`jsonish/src/parser.ts:2259-2490`)
5. **Type Coercion** → `coerceToBoolean()` (`jsonish/src/coercer.ts:49-59`) where `1 → true, 2 → false`
6. **Cache Pollution** → Wrong results returned for recursive contexts

#### Union Resolution System Deep Dive
- **Main Entry**: `coerceValue()` (line 1121) → `coerceUnion()` (line 2259)
- **Cache Management**: `unionResultCache` with 10s TTL, `recursionStack` Map tracking depth
- **Recursion Protection**: 25 depth limit with generic fallback
- **Scoring System**: `calculateUnionScore()` and `calculateUnionScoreOptimized()`

### Test Pattern Analysis

#### Working vs Failing Pattern Identification
| **Working Cases** | **Failing Cases** |
|-------------------|-------------------|
| Simple unions: `z.union([z.number(), z.boolean()])` | Complex recursive: `z.union([z.lazy(() => schema), z.number(), z.boolean()])` |
| Shallow recursion: 1-2 levels deep | Deep recursion: 3+ levels with multiple union branches |
| Single union branch per field | Multiple union branches at same depth (`rec_one` + `rec_two`) |
| Terminal values only | Mixed terminal/recursive values at same depth |

#### Specific Failing Test Analysis (`test/class.test.ts:946-996`)
- **Schema Structure**: Recursive object with `z.union([z.lazy(() => schema), z.number(), z.boolean()])`
- **Input**: `{ rec_two: { rec_one: { rec_one: { rec_one: 1, rec_two: 2 } } } }`
- **Expected**: Numbers `1` and `2` preserved at all nesting levels
- **Actual**: Numbers convert to booleans `true` and `false` at `rec_two.rec_one.rec_one` level
- **Depth Analysis**: Problem manifests at specific nesting depths in recursive structures

### Previous Implementation Failure Analysis

#### Failed Attempt Details (from `handoff_2025-08-28_17-25-48`)
- **Status**: All changes reverted via `git restore jsonish/src/parser.ts`
- **Attempted**: Major architectural rewrite + minimal cache key fix
- **Impact**: 53 failing tests (vs original 34) - broke basic functionality
- **Key Learning**: Sweeping changes cause massive regressions; **incremental approach required**

#### High-Risk Areas Identified
- **Union dispatch logic**: Multiple `coerceUnion*` functions with complex interdependencies
- **Caching mechanisms**: Union result cache and recursion depth tracker tightly coupled
- **Scoring system**: Changes affect all union resolution scenarios across codebase
- **Recursion handling**: Depth limits and fallback logic affect streaming/partial parsing

## Artifacts

### Research Documents
- **Primary Analysis**: `specifications/recursive-union-parsing/research/research_2025-09-03_10-52-44_recursive-union-bug-implementation-state.md`
  - Complete architectural analysis with file:line references
  - Detailed root cause analysis and fix strategy
  - Test pattern analysis and working vs failing case distinctions
  - Implementation phases and regression prevention approach

### Related Historical Documents  
- **Previous Handoff**: `specifications/recursive-union-parsing/handoffs/handoff_2025-08-28_17-25-48_recursive-union-implementation-failure-analysis.md`
  - Failed implementation attempt analysis
  - Risk assessment and lessons learned
  - Debug scripts and reproduction cases
- **Original Research**: `specifications/recursive-union-parsing/handoffs/handoff_2025-08-28_16-38-25_recursive-union-number-boolean-conversion-fix.md`
  - Initial root cause analysis and proposed solution
  - Rust vs TypeScript architectural comparison
  - Two-phase resolution implementation details

### Debug Tools Available
- **Test Command**: `bun test -t "should parse complex recursive structure"` for specific test
- **Full Test Suite**: `bun run tests` for regression checking (currently 34 failing tests baseline)
- **Build Validation**: `bun run build` for TypeScript compilation

## Action Items & Next Steps

### Phase 1: Critical Cache Key Fix (HIGH PRIORITY)

#### 1.1 Implement Schema Fingerprinting
- **File**: `jsonish/src/parser.ts:1873-1876`
- **Action**: Replace `createEfficientCacheKey()` to include union option types
- **Implementation**: Create `generateSchemaFingerprint()` function that differentiates union options
- **Test Validation**: Verify different union schemas produce different cache keys
- **Regression Check**: Ensure change doesn't break existing union resolution

#### 1.2 Enable Two-Phase Union Resolution
- **File**: `jsonish/src/parser.ts:2330`
- **Action**: Re-enable exact match phase (currently disabled for debugging)
- **Implementation**: Restore `tryDirectCast()` functionality for Phase 1 exact matching
- **Logic**: Only attempt coercion if exact match phase finds no candidates
- **Test Validation**: Numbers should match number schemas exactly before boolean coercion attempted

#### 1.3 Add Strict Type Matching Guards
- **File**: `jsonish/src/coercer.ts` (new functions needed)
- **Action**: Create `tryExactMatch()` equivalent to Rust's `try_cast`
- **Implementation**: Only allow same-type matches (number→number, boolean→boolean) in Phase 1
- **Integration**: Use in two-phase resolution before falling back to coercion

### Phase 2: Architecture Improvements (MEDIUM PRIORITY)

#### 2.1 Implement Penalty-Based Scoring System
- **File**: `jsonish/src/parser.ts:2496-2665`
- **Action**: Invert scoring system to match Rust implementation (lower scores = better)
- **Implementation**: Convert bonus system to penalty system with exact matches = 0 penalty
- **Impact Assessment**: Review all union resolution scenarios for compatibility

#### 2.2 Fix Schema-Aware Recursion Fallback
- **File**: `jsonish/src/parser.ts:2070-2091`
- **Action**: Replace `coerceValueGeneric()` with schema-aware depth limiting
- **Implementation**: Maintain schema context even at recursion limits
- **Test Impact**: Should fix deep recursive structure preservation

### Phase 3: Streaming/Partial Parsing Investigation (NEW DISCOVERY)

#### 3.1 Analyze Secondary Failing Test
- **Test**: `test/class.test.ts:1133` - "should handle partial resume parsing"
- **Error**: `ZodError: Invalid input: expected object, received string`
- **Investigation Needed**: Determine if related to cache collision issue or separate problem
- **Approach**: Analyze streaming parser flow and relationship to union resolution system

#### 3.2 Validate Fix Impact on Streaming
- **Action**: Ensure Phase 1 fixes don't break streaming/partial parsing functionality
- **Testing**: Run streaming tests after each incremental change
- **Integration**: Consider shared cache key generation impact on streaming contexts

### Phase 4: Comprehensive Testing & Validation (ONGOING)

#### 4.1 Establish Testing Protocol
- **Baseline**: Confirm 34 failing tests before starting (currently established)
- **Incremental**: Run specific test after each change: `bun test -t "should parse complex recursive structure"`
- **Regression**: Run full suite after each change: `bun run tests`
- **Target**: Reduce failing tests without introducing new failures

#### 4.2 Add Union Resolution Test Coverage
- **Coverage**: Exact match vs coercion preferences
- **Scenarios**: Different union option orders, cache isolation, recursion depth handling
- **Edge Cases**: Complex recursive structures, mixed terminal/recursive values

## Other Notes

### Critical Implementation Constraints

#### Development Environment
- **Runtime**: Use Bun instead of Node.js (`CLAUDE.md` project guidelines)
- **Testing**: Use `bun run tests` not `bun test` to avoid BAML codebase tests
- **TDD Approach**: Make incremental changes with immediate test validation

#### Risk Management
- **Regression Prevention**: Previous attempt caused 53 failing tests - proves high interdependency risk
- **Incremental Only**: Avoid architectural rewrites; focus on minimal targeted changes
- **Test-Driven**: Validate each change against specific failing test before proceeding
- **Rollback Ready**: Document each change for easy reversion if regressions occur

#### Code Architecture Context
- **TypeScript Port**: Goal is to match Rust implementation behavior while using Zod schemas
- **No BAML Features**: Focus on TypeScript + Zod, ignore BAML-specific capabilities
- **Structural Fidelity**: Maintain architectural similarity to original Rust implementation

### Key File Locations for Implementation

#### Primary Fix Targets
- **Cache Key Generation**: `jsonish/src/parser.ts:1873-1876` - Main fix location
- **Union Resolution**: `jsonish/src/parser.ts:2259-2490` - Two-phase implementation
- **Type Coercion**: `jsonish/src/coercer.ts:49-59` - Strict matching guards
- **Scoring System**: `jsonish/src/parser.ts:2496-2665` - Penalty-based conversion

#### Test Locations
- **Primary Failing Test**: `test/class.test.ts:946-996` - Main validation target
- **Secondary Failing Test**: `test/class.test.ts:1133` - Streaming issue
- **Working Union Tests**: `test/unions.test.ts` - Reference for correct behavior
- **Simple Recursive Tests**: `test/class.test.ts:731-756` - Working recursive examples

#### Reference Architecture
- **Original Rust**: `baml/engine/baml-lib/jsonish/src/deserializer/` - Implementation reference
- **Value Types**: `jsonish/src/value.ts:3-12` - Internal representation
- **Parser Entry**: `jsonish/src/parser.ts:23` - Main parsing flow

### Performance Considerations
- **Cache Performance**: Schema fingerprinting may increase memory usage
- **Two-Phase Cost**: Exact match phase adds processing overhead but prevents wrong coercions
- **Scoring Changes**: Penalty-based system may have different performance characteristics
- **Monitoring**: Track parsing speed for complex recursive structures during implementation

### Success Criteria
1. **Primary Test**: `test/class.test.ts:946-996` passes with numbers preserved as numbers
2. **Regression Prevention**: No increase in failing test count (maintain ≤34 failing tests)
3. **Streaming Compatibility**: Secondary test `test/class.test.ts:1133` addressed
4. **Architecture Integrity**: Changes align with original Rust implementation patterns

This handoff provides complete context for resuming implementation of the recursive union parsing fix, with specific emphasis on incremental changes, regression prevention, and comprehensive testing validation.