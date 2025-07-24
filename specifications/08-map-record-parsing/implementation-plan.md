---
date: 2025-07-24T14:15:00-08:00
researcher: Claude
git_commit: 9948d278b396332af7c8abc25f9756738b8a1f18
branch: master
repository: jsonish
topic: "Map/Record Parsing Implementation Strategy"
tags: [implementation, strategy, parser, deserializer, coercer, jsonish, map-parsing, record-parsing, key-coercion]
status: complete
last_updated: 2025-07-24
last_updated_by: Claude
type: implementation_strategy
---

# Map/Record Parsing Implementation Plan

## Overview

Implement robust map/record parsing for JSONish that handles dynamic key-value structures through Zod record schemas (`z.record()`). The current implementation has solid foundations with 38 of 42 tests passing, but critical gaps in key coercion, enum key support, error recovery, and parser integration prevent full functionality.

## Current State Analysis

### Key Discoveries:
- **Solid Foundation**: Value coercion, flag system, and type integration work correctly (`src/deserializer/coercer/coerce_map.ts:35-87`)
- **Critical Gap**: Key coercion completely missing at line 32 - keys used directly without coercion through `keyCoercer`
- **Missing Features**: No enum/literal key support, no string-to-JSON extraction, incomplete error recovery
- **Parser Integration**: Parser already handles objects correctly - same `Value` structure works for both maps and classes (`src/jsonish/value.ts:29-33`)

### Test Failures Analysis:
1. **Map with class object values**: Returns empty object instead of proper map structure
2. **Optional values**: Schema validation error for null values in optional fields
3. **Empty input graceful handling**: Returns string type instead of attempting map parsing
4. **Invalid JSON graceful handling**: Returns string type instead of graceful map fallback

## What We're NOT Doing

- Changing parser entry point or Value representation (already works correctly)
- Modifying the core scoring system or flag definitions (already properly integrated)
- Creating new test cases (47 comprehensive tests already exist and define requirements)
- Changing the coercer interface or deserializer routing (properly implemented)

## Implementation Approach

Focus on fixing the key coercion pipeline in the map coercer while preserving all working functionality. The parser → value → deserializer flow is correct; we need to complete the map coercer's key processing logic and improve error recovery.

## Phase 1: Implement Key Coercion Logic

### Overview
Complete the missing key coercion implementation to handle type conversion, enum validation, and error tracking.

### Changes Required:

#### 1. Map Coercer Key Processing
**File**: `src/deserializer/coercer/coerce_map.ts`
**Changes**: Replace missing key coercion logic at lines 30-33

```typescript
// Current broken implementation (line 32):
let keyStr = key  // ❌ No coercion

// Required implementation:
let keyFlags = new DeserializerConditions()
const keyValue = createString(key.toString(), keyCoercer.target)
const keyResult = keyCoercer.coerce(keyCtx, keyCoercer.target, keyValue)

if (keyResult instanceof ParsingError) {
    flags.addFlag(Flag.MapKeyParseError, { index: items.size, error: keyResult })
    continue // Skip this key-value pair
}

let keyStr = getValueAsString(keyResult) // Use coerced key
```

#### 2. Key Type Validation
**File**: `src/deserializer/coercer/coerce_map.ts`
**Changes**: Add key type validation before processing (insert before line 25)

```typescript
// Validate that key type is supported
function validateKeyType(keySchema: z.ZodSchema): boolean {
    if (keySchema instanceof z.ZodString) return true
    if (keySchema instanceof z.ZodEnum) return true  
    if (keySchema instanceof z.ZodLiteral && typeof keySchema.value === 'string') return true
    if (keySchema instanceof z.ZodUnion) {
        return keySchema.options.every(opt => 
            opt instanceof z.ZodLiteral && typeof opt.value === 'string')
    }
    return false
}

if (!validateKeyType(target.keyType || z.string())) {
    return new ParsingError("Maps must have string, enum, or literal string keys")
}
```

#### 3. Enhanced Value Processing
**File**: `src/deserializer/coercer/coerce_map.ts`
**Changes**: Improve value coercion with better error handling (lines 35-41)

```typescript
const valueResult = valueCoercer.coerce(keyCtx, target.element, val)
if (valueResult instanceof ParsingError) {
    flags.addFlag(Flag.MapValueParseError, { key: keyStr, error: valueResult })
    // Continue processing other entries instead of failing completely
} else {
    items.set(keyStr, [keyFlags, valueResult])
}
```

### Success Criteria:

**Automated verification**
- [ ] `bun test test/maps.test.ts` passes key coercion test (currently failing)
- [ ] `bun test` passes all tests
- [ ] `bun build` completes without errors
- [ ] No TypeScript errors

**Manual Verification**
- [ ] Keys coerced correctly: `{5: "b", 2.17: "e", null: "n"}` → `{"5": "b", "2.17": "e", "null": "n"}`
- [ ] Enum keys validated properly
- [ ] Literal union keys work as expected
- [ ] Key coercion failures tracked with `MapKeyParseError` flags

## Phase 2: String-to-Map Extraction and Error Recovery

### Overview
Add support for parsing string inputs as JSON objects for map extraction and improve graceful error handling.

### Changes Required:

#### 1. String Input Processing
**File**: `src/deserializer/coercer/coerce_map.ts`
**Changes**: Add string-to-JSON extraction (insert after line 20)

```typescript
// Handle string inputs by attempting JSON parsing
if (value.type === 'string') {
    try {
        const parsed = JSON.parse(value.value)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const objectValue: Value = {
                type: 'object',
                value: Object.entries(parsed).map(([k, v]) => [k, convertJSONToValue(v)]),
                completionState: CompletionState.Complete
            }
            flags.addFlag(Flag.StringToMap, { originalValue: value })
            return coerceMap(ctx, target, objectValue, keyCoercer, valueCoercer)
        }
    } catch (e) {
        // JSON parsing failed, continue with string processing
    }
}
```

#### 2. Empty Input Handling
**File**: `src/deserializer/coercer/coerce_map.ts`
**Changes**: Add empty input graceful handling (insert after string processing)

```typescript
// Handle empty string as empty map
if (value.type === 'string' && value.value.trim() === '') {
    const emptyMap = new Map<string, [DeserializerConditions, BamlValueWithFlags]>()
    return createMap(emptyMap, target, flags)
}
```

#### 3. Invalid Input Graceful Handling
**File**: `src/deserializer/coercer/coerce_map.ts`
**Changes**: Improve error recovery for non-object inputs

```typescript
// Graceful fallback for invalid inputs
if (!['object', 'array', 'string'].includes(value.type)) {
    const emptyMap = new Map<string, [DeserializerConditions, BamlValueWithFlags]>()
    flags.addFlag(Flag.CoercionError, { 
        message: `Cannot coerce ${value.type} to map`, 
        originalValue: value 
    })
    return createMap(emptyMap, target, flags)
}
```

### Success Criteria:

**Automated verification**
- [ ] `bun test test/maps.test.ts` passes empty input test (currently failing)
- [ ] `bun test test/maps.test.ts` passes invalid JSON test (currently failing)
- [ ] All string-to-map extraction tests pass
- [ ] Error recovery tests pass with graceful degradation

**Manual Verification**
- [ ] Empty strings return empty maps without throwing
- [ ] Invalid JSON strings return empty maps with proper error flags
- [ ] String inputs containing valid JSON objects parse correctly
- [ ] Mixed content extraction works properly

## Phase 3: Optional Values and Complex Object Support

### Overview
Fix optional value handling and improve support for complex object values in maps.

### Changes Required:

#### 1. Optional Value Processing
**File**: `src/deserializer/coercer/coerce_map.ts`
**Changes**: Improve optional value handling in value coercion

```typescript
// Enhanced optional value handling
const valueResult = valueCoercer.coerce(keyCtx, target.element, val)
if (valueResult instanceof ParsingError) {
    // Check if the error is due to null/undefined in optional field
    if (target.element.isOptional() && (val.type === 'null' || val.type === 'undefined')) {
        // For optional fields, null/undefined is acceptable
        items.set(keyStr, [keyFlags, createNull()])
    } else {
        flags.addFlag(Flag.MapValueParseError, { key: keyStr, error: valueResult })
    }
} else {
    items.set(keyStr, [keyFlags, valueResult])
}
```

#### 2. Complex Object Value Support
**File**: `src/deserializer/coercer/coerce_map.ts`
**Changes**: Ensure proper handling of object values in maps

```typescript
// Verify object value processing works correctly
// This should already work through existing value coercion,
// but add explicit test for complex nested structures
if (val.type === 'object' && target.element instanceof z.ZodObject) {
    // Object values should be processed through class coercer
    const valueResult = valueCoercer.coerce(keyCtx, target.element, val)
    // Continue with standard processing...
}
```

### Success Criteria:

**Automated verification**
- [ ] `bun test test/maps.test.ts` passes optional values test (currently failing)
- [ ] `bun test test/maps.test.ts` passes class object values test (currently failing)
- [ ] Complex nested map structures work correctly
- [ ] All 42 map tests pass

**Manual Verification**
- [ ] Maps with optional string values handle null properly
- [ ] Maps with complex object values create proper nested structures
- [ ] Nested map-of-maps work correctly
- [ ] No regressions in existing functionality

## Test Strategy

### Unit Tests
- [ ] Key coercion tests for all supported key types (string, enum, literal)
- [ ] Value coercion tests for complex types (objects, arrays, unions)
- [ ] Error recovery tests for malformed inputs
- [ ] String-to-map extraction tests

### Integration Tests
- [ ] End-to-end parsing with complex Zod record schemas
- [ ] Union type resolution between maps and objects
- [ ] Nested structure parsing (map-of-maps, maps with object values)
- [ ] Error flag propagation and scoring integration

### Edge Case Coverage
- [ ] Empty maps, large maps, deeply nested maps
- [ ] Special characters in keys (dots, spaces, newlines, Unicode)
- [ ] Mixed content extraction from text and markdown
- [ ] Streaming/partial JSON handling with maps

## Performance Considerations

- **Key Coercion Overhead**: Key coercion adds processing time but necessary for type safety
- **Memory Efficiency**: Use Map structure for efficient key-value storage 
- **Error Recovery**: Flag-based error handling avoids expensive exception processing
- **Union Resolution**: Scoring system prevents unnecessary full parsing attempts

## Migration Notes

No breaking changes to existing API. All changes are internal to the map coercer implementation. Existing code using `z.record()` schemas will automatically benefit from improved key coercion and error recovery.

## References 

* Original requirements: `specifications/08-map-record-parsing/feature.md`
* Related research: `specifications/08-map-record-parsing/research_2025-07-24_04-48-56_map-record-parsing-architecture.md`
* Current implementation: `src/deserializer/coercer/coerce_map.ts:32` (key coercion gap)
* Test expectations: `test/maps.test.ts:120-130` (key coercion), `test/maps.test.ts:423-436` (error handling)
* Rust reference: BAML `coerce_map.rs:88-107` (key coercion pipeline)
* Flag integration: `src/deserializer/deserialize_flags.ts:121` (MapKeyParseError)