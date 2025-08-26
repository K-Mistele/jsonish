---
date: 2025-08-26T17:43:14.3Z
researcher: Claude Code
git_commit: 1e3f518b3110c0d49947a983a1c4988c25cef173
branch: master
repository: jsonish
topic: "Object Parsing Test Failures Debug Analysis"
tags: [research, debug, object-parsing, nullable-schemas, recursive-objects, string-fallback, coercion, zod]
status: complete
last_updated: 2025-08-26
last_updated_by: Claude Code
type: research
---

# Research: Object Parsing Test Failures Debug Analysis

**Date**: 2025-08-26T17:43:14.3Z  
**Researcher**: Claude Code  
**Git Commit**: 1e3f518b3110c0d49947a983a1c4988c25cef173  
**Branch**: master  
**Repository**: jsonish

## Research Question

Debug the failing "Objects" tests in class.test.ts - determine if this is a regression, identify the root cause, and propose a comprehensive fix for object parsing failures affecting nullable fields, recursive structures, and string fallback behavior.

## Summary

The research revealed **three critical regressions** introduced in recent commits that are causing 10 out of 49 object parsing tests to fail:

1. **Null-to-String Conversion Issue**: Nullable schema fields receiving string `"null"` instead of actual `null` values
2. **Aggressive String Fallback**: Valid JSON objects being converted to strings causing `ZodError: expected object, received string`
3. **Recursive Structure Corruption**: Lazy schema resolution creating incorrect nesting levels in recursive objects

All issues stem from problematic changes to the `coerceToString` function and incorrect nullable schema handling logic introduced between commits 303ac543 and d9c19bd6.

## Detailed Findings

### 1. Null Value Handling Regression

**Root Cause**: The `ZodNullable` schema handler in `/Users/kyle/Documents/Projects/jsonish/jsonish/src/parser.ts:566-579` has incorrect logic order:

```typescript
if (schema instanceof z.ZodNullable) {
  try {
    return coerceValue(value, schema._def.innerType, ctx); // ← BUG: tries inner type first
  } catch {
    return null as z.infer<T>;
  }
}
```

**Critical Issue**: When processing `{ type: 'null' }` Values, the function attempts to coerce to the inner type (e.g., `z.string()`) before checking if the value is actually null. This triggers `coerceToString` at `/Users/kyle/Documents/Projects/jsonish/jsonish/src/coercer.ts:12-13`:

```typescript
case 'null':
  return 'null'; // ← Converts null Value to "null" string
```

**Impact**: All nullable fields (e.g., `z.string().nullable()`) receive `"null"` strings instead of `null` values, affecting 6+ test scenarios.

### 2. Parser Strategy String Fallback Issues

**Root Cause**: The 7-strategy parsing cascade in `/Users/kyle/Documents/Projects/jsonish/jsonish/src/parser.ts:15-115` has an overly aggressive string fallback mechanism:

```typescript
// Strategy 7: String fallback with type coercion (lines 112-114)
const stringValue = createStringValue(input);
return coerceValue(stringValue, schema, ctx);
```

**Flow Analysis**:
1. Valid JSON objects fail earlier strategies due to coercion bugs
2. All 6 previous strategies fail to handle the input properly
3. String fallback wraps JSON as `{ type: 'string', value: '{"key": "value"}' }`
4. `coerceValue` attempts to parse string as object schema
5. Zod receives string but expects object → `ZodError: expected object, received string`

**Strategy Restrictions**: Critical strategies (2, 4, 6) only execute for `ZodObject` or `ZodArray` schemas, leaving gaps for other object-compatible inputs.

### 3. Recursive Object Structure Corruption

**Root Cause**: Lazy schema resolution in `/Users/kyle/Documents/Projects/jsonish/jsonish/src/parser.ts:507-511` lacks proper depth control:

```typescript
if (schema instanceof z.ZodLazy) {
  const resolvedSchema = schema._def.getter();
  return coerceValue(value, resolvedSchema, ctx) as z.infer<T>; // ← No depth tracking
}
```

**Issue**: When parsing recursive objects, the resolver continues applying the lazy schema even when the value already matches the target structure:

- **Expected**: `{ pointer: { pointer: null } }`  
- **Actual**: `{ pointer: { pointer: { pointer: null } } }` ← Extra nesting layer

**Missing Logic**: Unlike the Rust implementation, there's no circular reference tracking for `(schema, value)` pairs to prevent over-application of recursive transformations.

### 4. Recent Commit Regression Analysis

**Commit 303ac543 (Aug 25, 21:06:08)**: Introduced null value stringification
- **File**: `jsonish/src/coercer.ts:13`
- **Change**: Added `case 'null': return 'null';`
- **Impact**: All null Values converted to "null" strings

**Commit d9c19bd6 (Aug 26, 08:33:44)**: Added object-to-TypeScript-string conversion
- **File**: `jsonish/src/coercer.ts:14-21`
- **Change**: Added object stringification logic in `coerceToString`
- **Impact**: Objects inappropriately converted to TypeScript interface strings

**Commit 08dcb57**: Enhanced enum parsing but affected nullable schema logic order
- **Impact**: Changed how nullable schemas are processed, breaking null preservation

## Code References

- `jsonish/src/parser.ts:566-579` - Broken ZodNullable handler logic order
- `jsonish/src/parser.ts:507-511` - Lazy schema resolution without depth tracking  
- `jsonish/src/parser.ts:112-114` - Overly aggressive string fallback mechanism
- `jsonish/src/coercer.ts:12-13` - Null-to-string conversion bug
- `jsonish/src/coercer.ts:14-21` - Inappropriate object stringification
- `jsonish/src/parser.ts:506` - Main coerceValue function entry point
- `jsonish/src/value.ts:39-40` - Value creation from null inputs
- `test/class.test.ts:323` - Nullable field test expecting null, receiving "null"
- `test/class.test.ts:700` - Recursive object test with extra nesting  
- `test/class.test.ts:224` - String fallback ZodError for valid JSON objects

## Parser Flow

Current broken flow for nullable objects:
1. JSON input `'{"email": null}'` → `JSON.parse()` → `{email: null}`
2. `createValueFromParsed()` → `{type: 'object', entries: [['email', {type: 'null'}]]}`
3. `coerceValue(value, z.object({email: z.string().nullable()}))` → `coerceObject()`
4. For email field: `coerceValue({type: 'null'}, z.string().nullable())` → `ZodNullable` handler
5. **BUG**: Handler tries `coerceValue({type: 'null'}, z.string())` → `coerceToString()`
6. `coerceToString()` → `"null"` string instead of preserving null

Correct flow should be:
1-4. Same as above
5. **FIX**: Handler checks `value.type === 'null'` → return `null` immediately
6. Result: `{email: null}` with proper null preservation

## Architecture Insights

### Error Recovery Mechanisms
- **JSON Fixing Strategy**: Works well for common malformations (trailing commas, unquoted keys)
- **State Machine Parser**: Handles severely malformed JSON but bypassed for many scenarios
- **Circular Reference Detection**: Implemented for object coercion but missing for lazy schemas

### Type Coercion Patterns  
- **String Priority Exception**: `z.ZodString` schemas bypass all strategies (lines 19-22)
- **Generic Fallback**: `coerceValueGeneric()` used when specific coercers fail
- **Value System**: Proper nested structure representation but conversion losses occur

### Scoring System Impact
- Union type resolution affected by null-to-string conversion
- Object vs string coercion scoring disrupted by improper string fallback
- Lazy schema resolution doesn't participate in proper scoring mechanisms

### Zod Schema Integration
- **Nullable/Optional Handling**: Core integration point where bugs manifest
- **Lazy Schema Support**: Incomplete implementation missing depth tracking
- **Transform/Refinement**: Could be affected by value type corruption

## Related Documentation

- `CLAUDE.md` - Parser architecture emphasizes TDD approach with test-driven fixes
- `specifications/requirements.md` - Original parser requirements for nullable field support
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/ir_ref/coerce_class.rs` - Rust reference implementation with proper circular detection

## Related Research

- `specifications/05-enum-parsing/research/` - Related enum parsing enhancements that affected nullable logic
- `specifications/02-object-class-parsing/research/` - Core object parsing architecture research
- `specifications/11-streaming-parsing/research/` - Streaming object parsing capabilities

## Fix Implementation Plan

### Priority 1: Critical Null Handling Fix

**File**: `jsonish/src/parser.ts:566-579`
```typescript
if (schema instanceof z.ZodNullable) {
  // Check for actual null Values first
  if (value.type === 'null') {
    return null as z.infer<T>;
  }
  
  // For nullable enum schemas, check explicit JSON null patterns
  if (value.type === 'string' && schema._def.innerType instanceof z.ZodEnum) {
    if (/```json\s*null\s*```/i.test(value.value)) {
      return null as z.infer<T>;
    }
  }
  
  // Then try coercing to inner type
  try {
    return coerceValue(value, schema._def.innerType, ctx) as z.infer<T>;
  } catch {
    return null as z.infer<T>;
  }
}
```

### Priority 2: Remove Inappropriate String Conversions

**File**: `jsonish/src/coercer.ts`
- Remove `case 'null': return 'null';` (line 13)
- Remove object-to-TypeScript-string conversion (lines 14-21)
- Preserve original behavior: only convert when truly targeting string schemas

### Priority 3: Fix Lazy Schema Resolution

**File**: `jsonish/src/parser.ts:507-511`
```typescript
if (schema instanceof z.ZodLazy) {
  // Add circular reference tracking for lazy schemas
  const resolvedSchema = schema._def.getter();
  
  // Check if value already matches target structure to prevent over-application
  if (ctx.visitedLazySchemas?.has(`${JSON.stringify(value)}-${resolvedSchema}`)) {
    throw new Error('Circular lazy schema reference detected');
  }
  
  const newCtx = {
    ...ctx,
    visitedLazySchemas: (ctx.visitedLazySchemas || new Set()).add(`${JSON.stringify(value)}-${resolvedSchema}`)
  };
  
  return coerceValue(value, resolvedSchema, newCtx) as z.infer<T>;
}
```

### Priority 4: Improve String Fallback Logic

**File**: `jsonish/src/parser.ts:112-114`
```typescript
// Before falling back to string, verify this isn't a valid JSON structure
if (schema instanceof z.ZodObject && input.trim().startsWith('{')) {
  throw new Error(`Failed to parse object - all strategies exhausted: ${input.slice(0, 100)}...`);
}
if (schema instanceof z.ZodArray && input.trim().startsWith('[')) {
  throw new Error(`Failed to parse array - all strategies exhausted: ${input.slice(0, 100)}...`);
}

// Only then apply string fallback
const stringValue = createStringValue(input);
return coerceValue(stringValue, schema, ctx);
```

## Validation Plan

### Testing Strategy
1. **Run specific failing tests**: `bun test ./test/class.test.ts -t "should handle object with nullable field"`
2. **Verify null preservation**: Tests expecting `null` should receive actual `null`, not `"null"`
3. **Check recursive structures**: Nested objects should maintain proper depth
4. **Validate string fallback**: Only inappropriate for obvious JSON structures

### Regression Prevention
1. **Add circular reference tests**: Prevent infinite lazy schema resolution
2. **Enhance null handling tests**: Cover all nullable/optional scenarios
3. **Improve error messages**: Better debugging for string fallback triggers

### Performance Validation
1. **Memory usage**: Ensure circular reference tracking doesn't leak memory
2. **Parsing speed**: Verify fixes don't introduce performance regressions
3. **Large object handling**: Test with complex nested structures

## Open Questions

1. **Backwards Compatibility**: Do any legitimate use cases depend on the current null-to-string conversion behavior?
2. **Error Handling**: Should string fallback be more restrictive or provide better error messages?
3. **Performance Impact**: What's the cost of enhanced circular reference tracking for lazy schemas?
4. **Test Coverage**: Are there edge cases in nullable/recursive parsing not covered by current tests?

This research provides a comprehensive foundation for implementing targeted fixes to restore proper object parsing functionality while maintaining the enhanced enum parsing capabilities introduced in recent commits.