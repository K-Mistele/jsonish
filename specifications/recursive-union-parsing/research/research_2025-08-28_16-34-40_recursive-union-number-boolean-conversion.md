---
date: 2025-08-28T16:34:40-05:00
researcher: Claude Code
git_commit: 466a2e6abb00006634d62df657476aaa48465351
branch: master
repository: jsonish
topic: "Recursive Union Number-to-Boolean Conversion Bug Analysis and Fix"
tags: [research, parser, union-resolution, recursive-types, type-coercion, caching, scoring-system]
status: complete
last_updated: 2025-08-28
last_updated_by: Claude Code
type: research
---

# Research: Recursive Union Number-to-Boolean Conversion Bug Analysis and Fix

**Date**: 2025-08-28T16:34:40-05:00
**Researcher**: Claude Code
**Git Commit**: 466a2e6abb00006634d62df657476aaa48465351
**Branch**: master
**Repository**: jsonish

## Research Question

Investigate and fix the failing test `"should parse complex recursive structure"` where numbers `1` and `2` are incorrectly converted to booleans `true` and `false` in deeply nested recursive union structures, while simple cases work correctly.

## Summary

The bug is caused by **four interconnected architectural issues** in the TypeScript implementation that diverge significantly from the original Rust implementation:

1. **Inverted Scoring Philosophy**: TypeScript uses "higher is better" while Rust uses "lower is better", causing inappropriate coercions to be preferred
2. **Missing Two-Phase Resolution**: TypeScript lacks the Rust `try_cast` → `coerce` → `pick_best` pattern, allowing immediate cross-type coercion
3. **Cache Key Collisions**: Different union schemas generate identical cache keys, causing result contamination across contexts
4. **Recursion Limit Fallback**: Deep nesting bypasses schema validation with `coerceValueGeneric()`, losing type information

The root cause is that the TypeScript port inverted the scoring philosophy without updating the selection logic, while also introducing cache collisions that compound the issue in recursive scenarios.

## Detailed Findings

### Original Rust Implementation Architecture

**File References:**
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_union.rs:8-94`
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/array_helper.rs:26-287`
- `baml/engine/baml-lib/jsonish/src/deserializer/score.rs:8-96`

#### Three-Phase Union Resolution
1. **try_cast Phase** (lines 8-67 in `coerce_union.rs`): Exact type matches only, no coercion
2. **coerce Phase** (lines 69-94): Coercion with penalty flags applied
3. **pick_best Selection** (lines 26-287 in `array_helper.rs`): Sophisticated multi-criteria sorting

#### Penalty-Based Scoring System (Lower is Better)
```rust
// From score.rs:35-76
Flag::StringToBool(_) => 1,        // Minor penalty for string→bool
Flag::FloatToInt(_) => 1,          // Minor penalty for float→int  
Flag::DefaultFromNoValue => 100,   // Severe penalty for defaults
Flag::UnionMatch(_, _) => 0,       // No penalty for union selection
```

#### Strict Type Boundaries
From `coerce_primitive.rs:70-87`:
```rust
TypeValue::Int => match value {
    Some(Value::Number(n, _)) => /* only numbers accepted */,
    _ => None, // Booleans strictly rejected
},
TypeValue::Bool => match value {
    Some(Value::Boolean(b)) => /* only booleans accepted */,  
    _ => None, // Numbers strictly rejected
},
```

### TypeScript Implementation Issues

#### 1. Inverted Scoring System

**File**: `jsonish/src/parser.ts:2496-2665`

TypeScript uses "higher is better" scoring:
```typescript
// calculateUnionScore function
if (schema instanceof z.ZodString) {
  if (value.type === 'string') {
    score += 100; // Exact match
  } else {
    score += 10; // Coercion possible
  }
}
```

**Critical Problem**: Cross-type coercions get high scores, making them competitive with exact matches.

#### 2. Missing Two-Phase Resolution  

**Issue**: TypeScript immediately attempts coercion without a strict type-matching phase.

From `jsonish/src/coercer.ts:49-59`:
```typescript
export function coerceToBoolean(value: Value, schema: z.ZodBoolean): boolean {
  switch (value.type) {
    case 'boolean': return value.value;     // Exact match
    case 'number': return value.value !== 0; // 1 becomes true!
    case 'string': return parseBooleanFromString(value.value);
  }
}
```

**Problem**: Numbers are immediately coercible to booleans without trying number schema first.

#### 3. Cache Key Collision System

**File**: `jsonish/src/parser.ts:1873-1876`

```typescript
function createEfficientCacheKey(value: Value, schema: z.ZodType): string {
  return `${schema.constructor.name}:${getValueHash(value)}`;
}
```

**Critical Collision**: Different union schemas produce identical cache keys:
- `z.union([z.number(), z.boolean()])` → `"ZodUnion:number:1"`
- `z.union([z.boolean(), z.number(), z.null()])` → `"ZodUnion:number:1"`

**Impact**: Results from one union context contaminate other union contexts.

#### 4. Recursion Limit Fallback

**File**: `jsonish/src/parser.ts:2070-2091`

```typescript
if (currentDepth >= 25) {
  // ... fallback logic
  if (value.type === 'object') {
    return coerceValueGeneric(value) as z.infer<T>; // Bypasses schema validation!
  }
}
```

**Problem**: Deep recursion triggers schema-unaware coercion, losing type specificity.

### Specific Test Case Analysis

**Test File**: `test/class.test.ts:946-996`

**Input Structure**:
```typescript
const schema = z.object({
  rec_one: z.union([z.lazy(() => schema), z.number(), z.boolean()]),
  rec_two: z.union([z.lazy(() => schema), z.number(), z.boolean(), z.null()])
});

const input = `{
  rec_one: { rec_one: { rec_one: true, rec_two: false }, rec_two: null },
  rec_two: {
    rec_one: { rec_one: { rec_one: 1, rec_two: 2 }, rec_two: null },
    rec_two: { rec_one: 1, rec_two: null }
  }
}`
```

**Expected vs Actual**:
```
Expected: { rec_one: 1, rec_two: 2 }
Received: { rec_one: true, rec_two: false }
```

**Failure Flow**:
1. **Deep nesting** reaches recursion limit (depth ≥25)
2. **Cache collision** between different union schemas with same constructor name
3. **Fallback coercion** bypasses schema-specific type validation
4. **Inverted scoring** prefers boolean coercion over number preservation
5. **Numbers 1,2 become booleans true,false**

## Code References

### Original Rust Implementation
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_union.rs:8-94` - Two-phase union resolution
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/array_helper.rs:26-287` - Sophisticated pick_best algorithm  
- `baml/engine/baml-lib/jsonish/src/deserializer/score.rs:8-96` - Penalty-based scoring system
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_primitive.rs:47-114` - Strict try_cast implementation
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_primitive.rs:314-374` - Penalty-aware boolean coercion

### TypeScript Implementation Issues
- `jsonish/src/parser.ts:2054-2289` - Union resolution with caching issues
- `jsonish/src/parser.ts:2496-2665` - Inverted scoring system (calculateUnionScore)
- `jsonish/src/parser.ts:1942-2012` - Alternative scoring (calculateUnionScoreOptimized)
- `jsonish/src/parser.ts:1873-1876` - Cache key collision system (createEfficientCacheKey)
- `jsonish/src/parser.ts:2070-2091` - Problematic recursion fallback
- `jsonish/src/coercer.ts:49-59` - Cross-type coercion without penalties
- `test/class.test.ts:946-996` - Failing recursive union test

## Parser Flow Comparison

### Rust Flow (Correct)
```
Input Value + Union Schema
    ↓
1. try_cast each option (exact matches only, score 0)
    ↓
2. If exact matches found → pick_best(exact_matches)  
    ↓
3. If no exact matches → coerce each option (with penalties +1 to +110)
    ↓
4. pick_best(coerced_results) using sophisticated multi-criteria sorting
    ↓
5. Return lowest-penalty option or error
```

### TypeScript Flow (Problematic)
```
Input Value + Union Schema
    ↓
1. Cache lookup (collision-prone keys)
    ↓
2. If cache miss → coerce all options immediately (no exact-match phase)
    ↓  
3. Score all results (higher-is-better, rewards coercion)
    ↓
4. Sort by score DESC (prefer highest scores)
    ↓
5. Return highest-score option (may be inappropriate coercion)
```

## Architecture Insights

### Key Rust Mechanisms Preventing Number→Boolean Errors
1. **Two-Phase Resolution**: `try_cast` prevents cross-type coercion unless no exact matches exist
2. **Penalty System**: Cross-type coercions get penalty flags that lower their selection priority
3. **Sophisticated Selection**: `pick_best` uses multiple criteria beyond just score
4. **Strict Type Boundaries**: Primitive try_cast methods reject incompatible types entirely
5. **Context-Aware Caching**: No global cache collisions between different schemas

### TypeScript Missing Mechanisms  
1. **No strict type matching phase**: Immediate coercion attempt for all union options
2. **Inverted scoring rewards coercion**: Higher scores for successful coercions compete with exact matches
3. **Cache key collisions**: Different schemas share cache entries inappropriately
4. **Schema-unaware fallbacks**: Recursion limits trigger generic coercion without type context
5. **Missing penalty system**: No scoring penalties for cross-type coercions

## Proposed Fix Implementation

### Phase 1: Critical Fixes (High Priority)

#### 1.1 Fix Cache Key Generation
```typescript
function createEfficientCacheKey(value: Value, schema: z.ZodType): string {
  const schemaFingerprint = generateSchemaFingerprint(schema);
  return `${schema.constructor.name}:${schemaFingerprint}:${getValueHash(value)}`;
}

function generateSchemaFingerprint(schema: z.ZodType): string {
  if (schema instanceof z.ZodUnion) {
    const optionHashes = schema._def.options.map(opt => 
      `${opt.constructor.name}:${JSON.stringify(opt._def).substring(0, 20)}`
    ).sort().join('|');
    return `union(${optionHashes})`;
  }
  // Add other schema types as needed
  return schema.constructor.name;
}
```

#### 1.2 Implement Two-Phase Resolution
```typescript
function coerceUnionTwoPhase<T extends z.ZodUnion<any>>(
  value: Value, 
  schema: T, 
  ctx: ParsingContext
): z.infer<T> {
  const options = schema._def.options;
  
  // Phase 1: Exact matches only (equivalent to Rust try_cast)
  const exactMatches = [];
  for (const option of options) {
    const exactResult = tryExactMatch(value, option, ctx);
    if (exactResult.success) {
      exactMatches.push({ result: exactResult.result, option, score: 100 });
    }
  }
  
  if (exactMatches.length > 0) {
    return exactMatches[0].result; // Prefer first exact match
  }
  
  // Phase 2: Coercion with penalties (equivalent to Rust coerce)
  const coercionResults = [];
  for (const option of options) {
    try {
      const result = coerceValue(value, option, ctx);
      const score = calculateUnionScoreWithPenalties(value, option, result);
      coercionResults.push({ result, option, score });
    } catch (error) {
      // Option failed, continue to next
    }
  }
  
  // Sort by score (lower is better, matching Rust)
  coercionResults.sort((a, b) => a.score - b.score);
  return coercionResults[0]?.result;
}
```

#### 1.3 Add Strict Type Matching
```typescript
function tryExactMatch(value: Value, schema: z.ZodType, ctx: ParsingContext): {success: boolean, result?: any} {
  // Only allow exact type matches, no coercion
  if (schema instanceof z.ZodNumber && value.type === 'number') {
    return { success: true, result: value.value };
  }
  if (schema instanceof z.ZodBoolean && value.type === 'boolean') {
    return { success: true, result: value.value };
  }
  if (schema instanceof z.ZodString && value.type === 'string') {
    return { success: true, result: value.value };
  }
  // Add other exact matches...
  return { success: false };
}
```

#### 1.4 Fix Scoring System with Penalties
```typescript
function calculateUnionScoreWithPenalties(value: Value, schema: z.ZodType, result: any): number {
  let score = 0; // Start with perfect score (lower is better)
  
  // Add penalties for cross-type coercion
  if (schema instanceof z.ZodBoolean && value.type !== 'boolean') {
    score += 1; // Penalty for boolean coercion
  }
  if (schema instanceof z.ZodNumber && value.type !== 'number') {
    score += 1; // Penalty for number coercion
  }
  if (schema instanceof z.ZodString && value.type !== 'string') {
    score += 1; // Penalty for string coercion
  }
  
  return score;
}
```

### Phase 2: Architecture Improvements (Medium Priority)

#### 2.1 Recursion-Aware Fallbacks
```typescript
if (currentDepth >= 25) {
  // Instead of generic coercion, use schema-aware depth limiting
  return handleRecursionLimitWithSchema(value, schema, ctx);
}

function handleRecursionLimitWithSchema<T>(value: Value, schema: z.ZodType, ctx: ParsingContext): T {
  // Try to preserve type information even at recursion limits
  if (schema instanceof z.ZodUnion) {
    // Use simplified union resolution with exact matches only
    return coerceUnionSimplified(value, schema, ctx);
  }
  // Fallback to generic coercion only as last resort
  return coerceValueGeneric(value) as T;
}
```

#### 2.2 Separate Caching Systems
```typescript
// Separate caches for different concerns
const unionResultCache = new Map<string, UnionCacheEntry>();
const recursionDepthTracker = new Map<string, number>(); // Different key generation

// Use different key generation for recursion tracking
function createRecursionKey(value: Value, schema: z.ZodType, depth: number): string {
  return `recursion:${depth}:${schema.constructor.name}:${getValueHash(value)}`;
}
```

### Phase 3: Testing and Validation

#### 3.1 Add Regression Tests
```typescript
describe('Union Resolution Fix', () => {
  it('should prefer exact matches over coercions', () => {
    const schema = z.union([z.number(), z.boolean()]);
    const result = parser.parse('1', schema);
    expect(result).toBe(1); // Not true
    expect(typeof result).toBe('number');
  });
  
  it('should handle recursive unions without type confusion', () => {
    // Test the exact failing case from class.test.ts
  });
  
  it('should maintain cache isolation between different union schemas', () => {
    // Test that different union configs don't contaminate each other
  });
});
```

## Related Documentation

- `CLAUDE.md` - JSONish architecture and development guidelines emphasizing TDD approach
- `baml/engine/baml-lib/jsonish/README.md` - Original Rust implementation documentation
- `test/class.test.ts` - Comprehensive recursive type testing
- `specifications/requirements.md` - Original parser requirements and BAML compatibility goals

## Open Questions

1. **Performance Impact**: How much will the two-phase resolution affect parsing performance for complex schemas?
2. **Backward Compatibility**: Will the scoring system changes affect existing working test cases?
3. **Cache Strategy**: Should we implement cache partitioning by schema fingerprint or disable caching for recursive unions?
4. **Recursion Limits**: What's the optimal recursion depth limit that balances performance with correctness?

## Conclusion

The number-to-boolean conversion bug stems from fundamental architectural divergences between the Rust and TypeScript implementations. The fix requires:

1. **Immediate**: Cache key collision fix to prevent cross-schema contamination
2. **Critical**: Two-phase resolution to prioritize exact matches over coercion  
3. **Essential**: Inverted scoring system to match Rust penalty-based approach
4. **Important**: Schema-aware recursion fallbacks to preserve type information

The proposed fixes align the TypeScript implementation with the proven Rust architecture while maintaining the Zod-based schema system that's central to the TypeScript port's design goals.