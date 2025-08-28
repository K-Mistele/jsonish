---
date: 2025-08-27T21:42:28-05:00
researcher: Claude Code Assistant
git_commit: 59f8f8ca2ef477e2e773c76a7a7f3bbe12cc9fd3
branch: master
repository: jsonish
topic: "Root cause analysis of null to string conversion in map/record parsing"
tags: [research, codebase, parser, coercion, zod-optional, null-handling, maps, records]
status: complete
last_updated: 2025-08-27
last_updated_by: Claude Code Assistant
type: research
---

# Research: Root Cause Analysis of Null to String Conversion in Map/Record Parsing

**Date**: 2025-08-27 21:42:28 CDT  
**Researcher**: Claude Code Assistant  
**Git Commit**: 59f8f8ca2ef477e2e773c76a7a7f3bbe12cc9fd3  
**Branch**: master  
**Repository**: jsonish

## Research Question

Determine the root cause of why null values in JSON maps/records are being converted to the string "null" instead of being handled properly as `undefined` for optional fields. The problem manifests in test failures where `{"key": null}` with `z.record(z.string().optional())` schema produces `{key: "null"}` instead of `{key: undefined}`.

## Summary

The root cause is a **missing null Value check in ZodOptional handling** in the `coerceValue` function. When processing a null Value with `z.string().optional()` schema, the parser attempts to coerce the null to the inner ZodString type instead of returning `undefined` directly. This triggers the string coercion pathway which explicitly converts null Values to the string "null".

**Critical Path**: null Value + ZodOptional → inner ZodString coercion → coerceToString → "null" string  
**Expected Path**: null Value + ZodOptional → immediate undefined return

## Detailed Findings

### Core Problem: ZodOptional Handling Logic

**Location**: `jsonish/src/parser.ts:944-957`

The ZodOptional handling lacks a critical null Value check:

```typescript
if (schema instanceof z.ZodOptional) {
  // MISSING: if (value.type === 'null') return undefined;
  
  // For optional enum schemas, check for explicit JSON null first
  if (value.type === 'string' && schema._def.innerType instanceof z.ZodEnum) {
    if (/```json\s*null\s*```/i.test(value.value)) {
      return undefined as z.infer<T>;
    }
  }
  
  try {
    return coerceValue(value, schema._def.innerType, ctx) as z.infer<T>; // ← PROBLEM
  } catch {
    return undefined as z.infer<T>;
  }
}
```

**Issue**: Line 953 attempts to coerce null Values to the inner schema type instead of returning `undefined` immediately.

### String Coercion: The Conversion Point

**Location**: `jsonish/src/coercer.ts:25-26`

```typescript
export function coerceToString(value: Value, schema: z.ZodString): string {
  switch (value.type) {
    case 'null':
      return 'null';  // ← EXPLICIT NULL TO STRING CONVERSION
    // ... other cases
  }
}
```

This function explicitly converts null Values to the string "null" when targeting string schemas.

### Complete Flow Analysis

1. **Input Processing**: `{"key": null}` → JSON.parse → `{key: null}` ✅
2. **Value Creation**: JavaScript null → `createValueFromParsed` → `{type: 'null'}` ✅  
3. **Record Coercion**: `coerceRecord` calls `coerceValue(nullValue, z.string().optional(), ctx)` ✅
4. **ZodOptional Detection**: `schema instanceof z.ZodOptional` → true ✅
5. **Inner Type Coercion**: Calls `coerceValue(nullValue, ZodString, ctx)` ❌ **Should return undefined**
6. **String Coercion**: `coerceToString(nullValue, ZodString)` → "null" ❌ **Wrong conversion**

### Record Coercion Integration

**Location**: `jsonish/src/parser.ts:2258-2272`

The record coercion system has multiple fallback layers:

```typescript
try {
  const coercedValue = coerceValue(val, valueSchema, newCtx); // ← Fails here
  result[coercedKey] = coercedValue;
} catch (error) {
  // Fallback strategies would use coerceValueGeneric which correctly handles null
  result[coercedKey] = coerceValueGeneric(val); // Returns actual null, not "null"
}
```

**The problem occurs in the primary path**, not the fallback mechanisms.

### Comparative Analysis: ZodNullable vs ZodOptional

**ZodNullable handling (lines 959-978)** correctly checks for null Values first:

```typescript
if (schema instanceof z.ZodNullable) {
  // Check for actual null Values first
  if (value.type === 'null') {
    return null as z.infer<T>; // ✅ Correct immediate return
  }
  // ... rest of logic
}
```

**ZodOptional handling (lines 944-957)** is missing the equivalent check:

```typescript
if (schema instanceof z.ZodOptional) {
  // MISSING: if (value.type === 'null') return undefined;
  // ... attempts inner type coercion instead
}
```

## Code References

- `jsonish/src/parser.ts:944-957` - ZodOptional handling with missing null check
- `jsonish/src/parser.ts:959-978` - ZodNullable handling with correct null check  
- `jsonish/src/coercer.ts:25-26` - Explicit null to "null" string conversion
- `jsonish/src/parser.ts:2258-2272` - Record coercion primary path
- `jsonish/src/parser.ts:984-1005` - coerceValueGeneric fallback (handles null correctly)
- `test/maps.test.ts:220-226` - Failing test case for optional values
- `test/maps.test.ts:400-412` - Failing test case for unterminated nested map

## Parser Flow

1. **Raw JSON Input** → `JSON.parse()` → JavaScript object with null values
2. **Value Creation** → `createValueFromParsed()` → `{type: 'null'}` Value objects  
3. **Record Coercion** → `coerceRecord()` → iterates over object entries
4. **Value Coercion** → `coerceValue(nullValue, optionalStringSchema)` 
5. **ZodOptional Processing** → attempts inner type coercion instead of returning undefined
6. **String Coercion** → `coerceToString()` → converts null to "null" string
7. **Final Result** → `{key: "null"}` instead of `{key: undefined}`

## Architecture Insights

- **Error Recovery Design**: The parser prioritizes converting everything to *something* rather than failing
- **Type Coercion Philosophy**: Each primitive coercer (string, number, boolean) has explicit null handling
- **Zod Integration Patterns**: Wrapper schemas (Optional, Nullable) have different null handling strategies
- **Fallback Mechanisms**: Multiple layers ensure parsing rarely fails, but can mask type conversion issues

## Fix Strategy

The fix requires adding a null Value check at the beginning of ZodOptional handling:

```typescript
if (schema instanceof z.ZodOptional) {
  // Check for actual null Values first  
  if (value.type === 'null') {
    return undefined as z.infer<T>;
  }
  
  // ... rest of existing logic
}
```

This mirrors the pattern used successfully in ZodNullable handling and prevents null Values from being coerced to inner schema types.

## Related Documentation

- `CLAUDE.md` - JSONish parser architecture and TDD approach
- `specifications/08-map-record-parsing/feature.md` - Map/record parsing requirements
- `test/maps.test.ts` - Comprehensive map parsing test suite with failing cases

## Open Questions

1. **Should null Values in optional fields become `undefined` or remain `null`?** Current implementation assumes undefined.
2. **Are there other wrapper schemas with similar null handling gaps?** ZodDefault, ZodCatch, etc.
3. **Should the string coercion explicitly reject null Values instead of converting to "null"?** This might break other legitimate use cases.

## Test Coverage Impact

The fix would make these test cases pass:
- `test/maps.test.ts:219-226` - "should parse map with optional values"
- `test/maps.test.ts:400-412` - "should handle unterminated nested map"

Both tests expect null JSON values in optional string fields to become `undefined` in the result.