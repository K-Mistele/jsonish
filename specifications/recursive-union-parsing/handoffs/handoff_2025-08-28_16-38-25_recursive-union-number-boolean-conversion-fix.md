---
date: 2025-08-28T16:38:25-05:00
researcher: Claude Code
git_commit: 466a2e6abb00006634d62df657476aaa48465351
branch: master
repository: jsonish
topic: "Recursive Union Number-Boolean Conversion Bug Fix Implementation Strategy"
tags: [implementation, strategy, union-resolution, parser, recursive-types, type-coercion, caching, scoring-system, debugging]
status: complete
last_updated: 2025-08-28
last_updated_by: Claude Code
type: implementation_strategy
---

# Handoff: Recursive Union Number-to-Boolean Conversion Bug Fix

## Task(s)

### Primary Task: Debug and Fix Failing Test (COMPLETED)
- **Status**: ✅ Root cause identified and comprehensive fix proposal created
- **Test**: `test/class.test.ts:946-996` - "should parse complex recursive structure"  
- **Issue**: Numbers `1` and `2` incorrectly converted to booleans `true` and `false` in deeply nested recursive union structures
- **Simple cases work correctly**: Issue only manifests in complex recursive contexts

### Secondary Tasks: Architecture Analysis (COMPLETED)
- **Status**: ✅ Comprehensive comparison of Rust vs TypeScript implementations completed
- **Status**: ✅ Cache collision analysis and reproduction scenario documented
- **Status**: ✅ Scoring system analysis and inversion issue identified

## Recent Changes

### Research Artifacts Created
- Generated comprehensive research document with full analysis and fix proposal
- Created debug reproduction script demonstrating the issue
- No code changes made - research and analysis phase only

### Debug Investigation  
- Identified specific failure point in union resolution at recursion depth ≥25
- Traced cache key generation collision scenarios
- Documented scoring system architectural divergence from original Rust implementation

## Learnings

### Root Cause Analysis: Four Interconnected Issues

#### 1. **Inverted Scoring Philosophy** (`jsonish/src/parser.ts:2496-2665`)
- **TypeScript**: "Higher is better" scoring - exact matches get 100 points, coercions also get 100+ points
- **Rust**: "Lower is better" penalty system - exact matches get 0, coercions get +1 to +110 penalties
- **Impact**: TypeScript rewards inappropriate cross-type coercions equally to exact matches
- **Evidence**: `calculateUnionScore()` gives boolean coercion from number 100+ points vs Rust's +1 penalty

#### 2. **Missing Two-Phase Resolution** 
- **Rust Pattern**: `try_cast` (exact only) → `coerce` (with penalties) → `pick_best` (sophisticated)
  - Location: `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_union.rs:8-94`
  - Strict boundaries: `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_primitive.rs:70-87`
- **TypeScript Issue**: Direct coercion without exact-match phase first
  - Location: `jsonish/src/coercer.ts:49-59` - `coerceToBoolean()` immediately accepts numbers
  - Problem: `case 'number': return value.value !== 0` converts 1 → true without trying number schema first

#### 3. **Cache Key Collisions** (`jsonish/src/parser.ts:1873-1876`)
```typescript
function createEfficientCacheKey(value: Value, schema: z.ZodType): string {
  return `${schema.constructor.name}:${getValueHash(value)}`;
}
```
- **Critical Issue**: Different union schemas generate identical keys
- **Example**: `z.union([z.number(), z.boolean()])` and `z.union([z.boolean(), z.number(), z.null()])` both produce `"ZodUnion:number:1"`
- **Impact**: Results from one union context contaminate different union contexts
- **Reproduction**: Complex recursive structures trigger cache hits from wrong schema contexts

#### 4. **Recursion Limit Fallback** (`jsonish/src/parser.ts:2070-2091`)
```typescript
if (currentDepth >= 25) {
  return coerceValueGeneric(value) as z.infer<T>; // Bypasses schema validation!
}
```
- **Problem**: Deep nesting triggers schema-unaware coercion
- **Impact**: Complex recursive structures lose type information and get improperly coerced
- **Test Case**: Failing test reaches this fallback, causing object flattening and type confusion

### Key Architectural Insights

#### Rust Implementation Strengths (`baml/engine/baml-lib/jsonish/src/deserializer/`)
- **Penalty-based scoring**: Lower scores preferred, exact matches = 0 penalty
- **Strict type boundaries**: `try_cast` prevents cross-type coercion unless no exact matches
- **Sophisticated selection**: `array_helper.rs:26-287` multi-criteria sorting beyond just score
- **Context isolation**: No global cache collisions between different schemas
- **Controlled recursion**: Proper circular reference detection without schema bypass

#### TypeScript Implementation Gaps
- **Bonus-based scoring**: Higher scores preferred, rewards successful coercion
- **Immediate coercion**: No strict type matching phase before attempting conversions  
- **Simple selection**: Basic score sorting without semantic correctness prioritization
- **Cache contamination**: Schema-agnostic caching causes cross-contamination
- **Recursion bypass**: Generic fallback loses schema context

### Specific Code Locations

#### Critical Fix Points
- **Cache Key Generation**: `jsonish/src/parser.ts:1873-1876` - Add schema fingerprinting
- **Union Resolution**: `jsonish/src/parser.ts:2054-2289` - Implement two-phase approach
- **Type Coercion**: `jsonish/src/coercer.ts:49-59` - Add strict type matching phase
- **Scoring System**: `jsonish/src/parser.ts:2496-2665` - Invert to penalty-based
- **Recursion Fallback**: `jsonish/src/parser.ts:2070-2091` - Schema-aware fallback

#### Test Locations
- **Failing Test**: `test/class.test.ts:946-996` - Main regression test
- **Debug Script**: `/Users/kyle/Documents/Projects/jsonish/debug-recursive-unions.js` - Reproduction case
- **Working Cases**: `test/basics.test.ts` - Simple union cases that work correctly

## Artifacts

### Research Documents
- **Primary Research**: `specifications/recursive-union-parsing/research/research_2025-08-28_16-34-40_recursive-union-number-boolean-conversion.md`
  - Complete architectural comparison
  - Detailed root cause analysis with file:line references
  - Comprehensive fix proposal with implementation code
  - Phase-based rollout plan

### Debug Tools
- **Reproduction Script**: `/Users/kyle/Documents/Projects/jsonish/debug-recursive-unions.js`
  - Demonstrates simple vs complex case behavior
  - Shows exact failure scenario from test
  - Can be used for fix validation

### Code Analysis
- **Original Rust Implementation**: `baml/engine/baml-lib/jsonish/src/deserializer/`
  - `coercer/coerce_union.rs` - Two-phase union resolution
  - `coercer/array_helper.rs` - Sophisticated selection algorithm
  - `score.rs` - Penalty-based scoring system
  - `coercer/coerce_primitive.rs` - Strict type boundaries

## Action Items & Next Steps

### Phase 1: Critical Fixes (HIGH PRIORITY)

#### 1.1 Fix Cache Key Generation
- **File**: `jsonish/src/parser.ts:1873-1876`
- **Action**: Implement schema fingerprinting to prevent collisions
- **Code**: Add `generateSchemaFingerprint()` function that includes union option details
- **Test**: Verify different union schemas produce different cache keys

#### 1.2 Implement Two-Phase Union Resolution  
- **File**: `jsonish/src/parser.ts:2054-2289`
- **Action**: Replace direct coercion with `tryExactMatch()` → `coerceWithPenalties()` pattern
- **Code**: Create `coerceUnionTwoPhase()` function matching Rust architecture
- **Test**: Verify exact matches preferred over coercions

#### 1.3 Add Strict Type Matching
- **File**: `jsonish/src/coercer.ts` (new functions)
- **Action**: Create `tryExactMatch()` equivalent to Rust's `try_cast`
- **Code**: Only allow same-type matches (number→number, boolean→boolean)
- **Test**: Verify numbers can't match boolean schemas in exact phase

#### 1.4 Fix Scoring System
- **File**: `jsonish/src/parser.ts:2496-2665`
- **Action**: Invert to penalty-based scoring (lower is better)
- **Code**: Add penalties for cross-type coercions (+1 for boolean conversion, etc.)
- **Test**: Verify exact matches score better than coercions

### Phase 2: Architecture Improvements (MEDIUM PRIORITY)

#### 2.1 Schema-Aware Recursion Fallback
- **File**: `jsonish/src/parser.ts:2070-2091`
- **Action**: Replace `coerceValueGeneric()` with schema-aware depth limiting
- **Code**: Implement `handleRecursionLimitWithSchema()` 
- **Test**: Verify deep recursion preserves type information

#### 2.2 Separate Caching Systems
- **File**: `jsonish/src/parser.ts:9-14`
- **Action**: Separate union result cache from recursion depth tracker
- **Code**: Use different key generation for different cache purposes
- **Test**: Verify cache isolation between different concerns

### Phase 3: Testing & Validation (ONGOING)

#### 3.1 Fix Primary Regression Test
- **File**: `test/class.test.ts:946-996`
- **Action**: Verify test passes with new implementation
- **Expected**: Numbers 1,2 remain numbers, not converted to booleans true,false

#### 3.2 Add Comprehensive Union Resolution Tests
- **Action**: Create test suite covering exact match vs coercion preferences
- **Coverage**: Different union option orders, cache isolation, recursion depth handling
- **Validation**: Ensure no regressions in existing test cases

#### 3.3 Performance Validation
- **Action**: Benchmark two-phase resolution vs current approach
- **Metrics**: Parsing speed for complex recursive structures
- **Optimization**: Consider caching strategies for performance if needed

## Other Notes

### Development Approach
- **TDD Pattern**: Project uses Test-Driven Development (see `CLAUDE.md`)
- **Bun Runtime**: Use `bun run tests` not `bun test` to avoid BAML codebase tests
- **Build Command**: `bun run build` for TypeScript compilation

### Important Context
- **TypeScript Port Goal**: Match Rust implementation behavior while using Zod schemas
- **No BAML Features**: Don't include BAML-specific language features, focus on TypeScript + Zod
- **Architecture Fidelity**: Maintain structural similarity to original Rust implementation

### Reference Commands
```bash
# Run specific failing test
bun test -t "should parse complex recursive structure"

# Run all JSONish tests (avoid BAML tests)
bun run tests

# Build and check types
bun run build

# Debug reproduction
bun debug-recursive-unions.js
```

### Key Patterns Discovered
- **Union Resolution Flow**: Input → try_cast → coerce → pick_best → result
- **Scoring Philosophy**: Penalties better than bonuses for avoiding incorrect coercions
- **Cache Strategy**: Schema context must be included in cache keys for correctness
- **Recursion Handling**: Depth limits should maintain schema awareness, not bypass it

### Related Issues to Watch
- **Performance**: Two-phase resolution may impact parsing speed
- **Memory**: Schema fingerprinting may increase memory usage
- **Compatibility**: Scoring changes could affect other union resolution scenarios

This handoff provides complete context to resume implementation of the recursive union parsing fix. The research document contains detailed implementation code and the reproduction script enables testing throughout development.