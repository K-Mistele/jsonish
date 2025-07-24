---
date: 2025-07-24T04:42:00-08:00
researcher: Claude
git_commit: d53a90dd5e86dba3eef4dd90576650f5b5ca57e1
branch: master
repository: jsonish
topic: "Union Type Resolution Implementation Strategy"
tags: [implementation, strategy, union-types, discriminated-unions, scoring-algorithm, type-selection, validation-based-selection, enum-discrimination, jsonish]
status: complete
last_updated: 2025-07-24
last_updated_by: Claude
type: implementation_strategy
---

# Union Type Resolution Implementation Plan

## Overview

This implementation strategy addresses the refinement and completion of union type resolution capabilities in the JSONish TypeScript parser. The core union resolution system is already implemented with sophisticated scoring algorithms, but requires targeted fixes to achieve full feature parity with the Rust implementation and pass all test cases.

## Current State Analysis

### Implemented and Functional:
- **Union Coercer**: Complete implementation in `src/deserializer/coercer/coerce_union.ts:14-120` with parallel evaluation and scoring-based selection
- **Scoring System**: Sophisticated flag-based scoring in `src/deserializer/score.ts` and `src/deserializer/deserialize_flags.ts:201-203`
- **Zod Integration**: Full schema integration through `src/deserializer/coercer/field_type.ts:152-155`
- **Context Tracking**: Complete parsing context with scope tracking and error propagation
- **Test Coverage**: 13/17 union tests passing with real-world scenarios covered

### Key Discoveries:
- Union resolution uses parallel evaluation strategy (not sequential) matching Rust implementation
- Flag-based scoring system with 0-point penalty for `Flag.UnionMatch` promotes clean union resolution
- `any_of` value integration provides seamless parser → coercer pipeline for multiple possibilities
- Complex discriminated unions and validation-based selection mostly working

### Critical Issues Identified:
1. **String Quote Preservation** (`test/unions.test.ts:315-321`): Expected `"hello"` but got `hello` (quotes stripped)
2. **Complex Discriminated Union Validation** (`test/unions.test.ts:47-83`): Schema validation failing after successful coercion
3. **Optional Field Handling** (`test/unions.test.ts:86-249`): Null vs undefined handling in complex API response objects
4. **Graceful Error Handling** (`test/unions.test.ts:391-397`): Should handle impossible matches gracefully instead of throwing

## What We're NOT Doing

- Rewriting the union coercer from scratch (it's already sophisticated and largely correct)
- Changing the core scoring algorithm architecture (it mirrors Rust implementation effectively)
- Modifying the flag system or `BamlValueWithFlags` structure (well-designed and functional)
- Adding new union types beyond what Zod provides (focus on existing z.union and z.discriminatedUnion)

## Implementation Approach

This strategy focuses on **debugging and refinement** rather than new feature development. Each phase targets specific failing test cases with minimal, surgical changes that preserve the existing architecture while fixing edge cases.

## Phase 1: String Handling and Quote Preservation

### Overview
Fix string quote preservation issues in union contexts, ensuring string values maintain proper quoting when selected as the best union match.

### Changes Required:

#### 1. String Value Preservation in Union Context
**File**: `src/deserializer/coercer/coerce_union.ts`
**Changes**: Ensure string values preserve original formatting when selected

**Investigation needed**:
```typescript
// Current issue: test/unions.test.ts:315-321
expect(result.value).toEqual("hello")  // Expected
// But getting: hello (without quotes)
```

**Debug approach**:
1. Trace string value through union resolution pipeline
2. Check if quote stripping occurs in coerceString vs selectBestUnionMatch
3. Verify `any_of` value handling preserves original string formatting

#### 2. String Priority Logic Verification
**File**: `src/deserializer/coercer/field_type.ts:45-75`
**Changes**: Verify `any_of` string schema priority logic matches Rust implementation

```typescript
// Ensure this logic properly handles quoted strings
if (target instanceof z.ZodString || target instanceof z.ZodEnum) {
  return this.coerce(ctx, target, stringValue)
}
```

### Success Criteria:

**Automated Verification**
- [ ] `bun test ./test/unions.test.ts` - string parsing test passes (line 315-321)
- [ ] `bun test` - no regressions in other string handling tests
- [ ] `bun build` - no TypeScript errors

**Manual Verification**
- [ ] String values in unions preserve exact quoting from input
- [ ] String vs number preference maintains "1 cup unsalted butter" → string behavior
- [ ] Mixed content extraction preserves string formatting in union contexts

## Phase 2: Complex Discriminated Union Validation

### Overview
Fix schema validation failures that occur after successful coercion in complex discriminated unions, ensuring Zod validation consistency.

### Changes Required:

#### 1. Zod Validation Consistency
**File**: `src/deserializer/coercer/coerce_union.ts:75-93`
**Changes**: Add post-coercion Zod validation check before marking union match as successful

```typescript
// After successful coercion, validate against target schema
if (!(result instanceof ParsingError)) {
  const zodResult = target.options[i].safeParse(extractValue(result))
  if (!zodResult.success) {
    // Convert to ParsingError but keep coercion result for scoring
    results.push({ ok: false, error: createValidationError(zodResult.error) })
  } else {
    results.push({ ok: true, value: result })
  }
}
```

#### 2. Discriminated Union Field Validation
**File**: `src/deserializer/coercer/ir_ref/coerce_class.ts`
**Changes**: Enhance discriminator field validation for complex unions

**Investigation needed**:
- Check if discriminator fields (like `cat: z.enum(["A", "C"])`) are properly validated
- Ensure enum coercion integrates properly with discriminated union selection
- Verify optional field handling doesn't interfere with discriminator matching

### Success Criteria:

**Automated Verification**
- [ ] `bun test ./test/unions.test.ts` - complex discriminated union test passes (line 47-83)
- [ ] Complex API response union test approaches passing (line 86-249)
- [ ] `bun build` - no TypeScript errors

**Manual Verification**
- [ ] Discriminator fields properly validated against enum constraints
- [ ] Schema validation errors provide clear feedback about union match failures
- [ ] Complex nested unions resolve correctly with proper field validation

## Phase 3: Optional Field and API Response Union Handling

### Overview
Fix null vs undefined handling in complex API response objects with optional fields, ensuring proper discriminated union resolution for real-world scenarios.

### Changes Required:

#### 1. Optional Field Coercion Logic
**File**: `src/deserializer/coercer/ir_ref/coerce_class.ts:21-381`
**Changes**: Improve optional field handling with proper null/undefined distinction

**Investigation needed**:
```typescript
// Current issue with optional fields in API response unions
sections: z.array(z.object({
  content: z.object({
    richText: z.object({ text: z.string() }).optional(),
    companyBadge: z.object({...}).optional(),
    // Multiple optional fields causing validation issues
  }),
}))
```

**Debug approach**:
1. Check how `z.ZodOptional` fields are handled in complex objects
2. Verify null vs undefined handling in optional field coercion
3. Ensure optional field defaults don't interfere with union scoring

#### 2. API Response Discriminator Support
**File**: `src/deserializer/coercer/coerce_union.ts`
**Changes**: Enhance action-based discrimination for API response patterns

```typescript
// Support discriminator patterns like:
// { action: "RESPOND_TO_USER", sections: [...] }
// vs { action: "OTHER_ACTION", data: {...} }
```

### Success Criteria:

**Automated Verification**
- [ ] Complex API response union test passes (line 86-249)
- [ ] `bun test ./test/unions.test.ts` - all optional field tests pass
- [ ] `bun build` - no TypeScript errors

**Manual Verification**
- [ ] API response discriminators work correctly with action fields
- [ ] Optional nested objects handle null/undefined properly
- [ ] Complex unions with multiple optional fields resolve accurately

## Phase 4: Graceful Error Handling and Edge Cases

### Overview
Implement graceful degradation for impossible union matches and edge cases, ensuring the system never throws unexpected errors.

### Changes Required:

#### 1. Graceful Union Match Failure
**File**: `src/deserializer/coercer/coerce_union.ts:70-73`
**Changes**: Enhance error handling when no union member matches

```typescript
// Instead of hard error, provide graceful fallback
if (successes.length === 0) {
  // Try original string interpretation as last resort
  if (value?.type === 'string') {
    const stringResult = tryStringFallback(ctx, target, value)
    if (!(stringResult instanceof ParsingError)) {
      return stringResult
    }
  }
  
  // Return detailed error with union attempt summary
  return ctx.errorMergeMultiple('No union variant matched', errors)
}
```

#### 2. Empty and Edge Input Handling
**File**: `src/deserializer/coercer/coerce_union.ts`
**Changes**: Add special handling for empty/null/undefined input in union contexts

```typescript
// Handle edge cases gracefully
if (!value || value.type === 'null') {
  // Check if any union member accepts null
  const nullableOptions = target.options.filter(opt => 
    opt instanceof z.ZodNullable || opt instanceof z.ZodOptional
  )
  if (nullableOptions.length > 0) {
    return coerceNullToUnion(ctx, nullableOptions[0], value)
  }
}
```

### Success Criteria:

**Automated Verification**
- [ ] `bun test ./test/unions.test.ts` - "impossible match" test passes gracefully (line 391-397)
- [ ] `bun test` - all edge case and error handling tests pass
- [ ] `bun build` - no TypeScript errors

**Manual Verification**
- [ ] No union member match scenarios handled without exceptions
- [ ] Empty input gracefully handled in union contexts
- [ ] Error messages provide helpful debugging information

## Test Strategy

### Unit Tests
- [ ] All 17 tests in `test/unions.test.ts` pass without exceptions
- [ ] String handling tests maintain quote preservation
- [ ] Complex discriminated union tests validate properly
- [ ] API response union tests handle optional fields correctly

### Integration Tests
- [ ] Union resolution integrates properly with streaming parser (`test/streaming.test.ts`)
- [ ] Mixed content extraction works with union types
- [ ] Constraint validation works correctly with union selection

### Regression Tests
- [ ] No existing functionality broken by union handling changes
- [ ] Performance characteristics maintained for large union schemas
- [ ] Memory usage remains bounded for complex nested unions

## Performance Considerations

**Scoring Algorithm Efficiency**: Current parallel evaluation maintains good performance characteristics - preserve this approach

**Discriminator Fast Path**: Consider adding early exit optimization for clear discriminator matches to improve performance on complex unions

**Memory Usage**: The existing flag system and value tracking is memory-efficient - no changes needed

## Migration Notes

No breaking changes expected - all modifications are internal refinements to existing union resolution logic. The public API and behavior should remain consistent while fixing edge cases.

## References

* Original requirements: `specifications/06-union-type-resolution/feature.md`
* Rust architecture research: `specifications/06-union-type-resolution/research_2025-07-23_23-21-13_rust-union-type-resolution-architecture.md`
* Current union coercer: `src/deserializer/coercer/coerce_union.ts:14-120`
* Union test cases: `test/unions.test.ts:1-400`
* Scoring system: `src/deserializer/score.ts` and `src/deserializer/deserialize_flags.ts:201-203`
* Field type integration: `src/deserializer/coercer/field_type.ts:152-155`