---
date: 2025-08-27T22:28:15-05:00
researcher: Claude
git_commit: 76ad002f52fe134ce73395ca6e3dd8ad26ad39bc
branch: master
repository: jsonish
topic: "Rust vs TypeScript Map/Record Parsing Implementation Comparison"
tags: [research, codebase, map-parsing, record-parsing, malformed-json, duplicate-keys, error-recovery, rust-comparison]
status: complete
last_updated: 2025-08-27
last_updated_by: Claude
type: research
---

# Research: Rust vs TypeScript Map/Record Parsing Implementation Comparison

**Date**: 2025-08-27T22:28:15-05:00
**Researcher**: Claude
**Git Commit**: 76ad002f52fe134ce73395ca6e3dd8ad26ad39bc
**Branch**: master
**Repository**: jsonish

## Research Question
Based on the handoff document `specifications/03-advanced-object-parsing/handoffs/handoff_2025-08-27_21-49-19_malformed-json-recovery-fixes.md`, analyze the differences between the original Rust implementation and current TypeScript implementation for map/record parsing, particularly focusing on malformed JSON patterns like `"field13": null{...}` and duplicate key handling to identify sources of the "expected object, received string" error.

## Summary
The TypeScript implementation is missing critical duplicate key handling that the Rust implementation provides. The current error stems from the parser successfully fixing malformed JSON but failing during array coercion because duplicate keys are not properly consolidated into arrays. The Rust implementation has sophisticated duplicate key detection and array coercion that the TypeScript version lacks.

## Detailed Findings

### Rust Implementation Architecture

**Core Components:**
- **Entry Point**: `baml/engine/baml-lib/jsonish/src/jsonish/parser/entry.rs:15-247`
- **Map Coercion**: `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_map.rs:1-191`
- **State Machine**: `baml/engine/baml-lib/jsonish/src/jsonish/parser/fixing_parser/json_parse_state.rs:460-838`

**6-Strategy Parsing Approach:**
1. Standard JSON.parse()
2. Markdown/Code Block Extraction
3. Multi-JSON Object Parsing
4. JSON Auto-Fixing
5. Schema-based Text Extraction
6. String Fallback

**Key Rust Features Missing in TypeScript:**
- **Duplicate Key Collection**: Automatically consolidates multiple values for the same key into arrays
- **Context-Aware String Boundary Detection**: Smart termination of unquoted strings based on JSON structure context
- **Flag-based Error Tracking**: Detailed error metadata without stopping overall parsing
- **Content Truncation Logic**: Intelligent boundary detection for embedded malformed content

### TypeScript Implementation Analysis

**Core Architecture** (`jsonish/src/parser.ts`):
- **7-Strategy Approach**: Extended from Rust's 6 strategies
- **Value System**: Internal representation in `jsonish/src/value.ts`
- **Coercion System**: Type-specific coercion with Zod integration

**Current Implementation Status:**
- ✅ Malformed JSON fixing implemented (`fixing-parser.ts:488-532`)
- ✅ Multi-strategy parsing cascade
- ❌ **Missing: Duplicate key handling** - No logic to detect/consolidate duplicate keys
- ❌ **Missing: Array coercion for duplicate values** - Keys overwrite instead of merging
- ⚠️ Two fixing functions disabled due to corruption issues

## Code References

### Rust Implementation
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_map.rs:88-190` - Map coercion with error recovery
- `baml/engine/baml-lib/jsonish/src/jsonish/parser/fixing_parser/json_parse_state.rs:133-320` - Context-aware string boundary detection
- `baml/engine/baml-lib/jsonish/src/jsonish/parser/fixing_parser/json_collection.rs:103-124` - Content conversion strategy

### TypeScript Implementation
- `jsonish/src/parser.ts:1130-1194` - Object coercion (missing duplicate key handling)
- `jsonish/src/parser.ts:1348-1383` - Array coercion logic
- `jsonish/src/fixing-parser.ts:488-532` - Malformed value structure conversion
- `jsonish/src/value.ts:8` - Object entries stored as `[string, Value][]`
- `test/basics.test.ts:949` - Failing test case

## Parser Flow Comparison

### Rust Flow (Working)
1. Raw input → Entry parser → Multi-strategy cascade
2. Malformed JSON → State machine → Context-aware boundary detection
3. `null{...}` pattern → Unquoted string collection → String conversion
4. **Duplicate keys** → Flag system → Array consolidation
5. Map coercion → Individual field error tracking → Success with metadata

### TypeScript Flow (Current Issue)
1. Raw input → Parser → 7-strategy cascade
2. Malformed JSON → Fixing parser → Pattern conversion ✅
3. `null{...}` pattern → String conversion ✅  
4. **Duplicate keys** → Last value wins (overwrites) ❌
5. Object coercion → Zod validation → "expected object, received string" ❌

## Architecture Insights

### Critical Missing Component: Duplicate Key Handling

**Rust Implementation:**
```rust
// coerce_map.rs:141-180 - Sequential processing with error accumulation
for (key, value) in object_entries {
    match coerce_field(key, value, schema) {
        Ok(result) => results.push((key, result)),
        Err(error) => {
            flags.push(Flag::MapValueParseError(key, error));
            // Continue processing other keys
        }
    }
}
```

**TypeScript Implementation (Missing):**
```typescript
// Current: Object entries stored as [string, Value][] but no duplicate consolidation
// Missing: Logic to detect multiple entries with same key and create arrays
```

### Root Cause Analysis

**Primary Issue**: The failing test has two `foo2` keys:
1. First `foo2`: Object with fields field7-field25
2. Second `foo2`: Array with object containing field26-field27

**Rust Behavior**: Would consolidate both values into a single `foo2` array
**TypeScript Behavior**: Second `foo2` overwrites first, then fails array coercion when schema expects object array but gets string

**Error Chain**:
1. Malformed JSON → Fixed successfully ✅
2. Object parsing → Duplicate key overwrites ❌
3. Array coercion → String fallback triggers ❌
4. Zod validation → "expected object, received string" ❌

## Related Documentation

- `CLAUDE.md` - JSONish architecture overview and TDD approach
- `specifications/03-advanced-object-parsing/handoffs/handoff_2025-08-27_21-49-19_malformed-json-recovery-fixes.md` - Previous implementation attempts
- `test/basics.test.ts` - Comprehensive test suite with 236+ test cases

## Related Research

- Previous handoff documents in `specifications/03-advanced-object-parsing/handoffs/` show progression of malformed JSON fixes

## Recommended Fix Strategy

### 1. Implement Duplicate Key Detection (High Priority)

**Location**: `jsonish/src/parser.ts` - `coerceObject()` function around line 1140

**Implementation**:
```typescript
// Add duplicate key consolidation logic
function consolidateDuplicateKeys(entries: [string, Value][]): [string, Value][] {
  const keyMap = new Map<string, Value[]>();
  
  // Collect all values for each key
  for (const [key, value] of entries) {
    if (!keyMap.has(key)) {
      keyMap.set(key, []);
    }
    keyMap.get(key)!.push(value);
  }
  
  // Convert to single values or arrays as appropriate
  const result: [string, Value][] = [];
  for (const [key, values] of keyMap) {
    if (values.length === 1) {
      result.push([key, values[0]]);
    } else {
      // Create array value for duplicates
      result.push([key, { type: 'array', items: values, completion: 'complete' }]);
    }
  }
  
  return result;
}
```

### 2. Enhanced Array Coercion for Schema Matching (Medium Priority)

**Location**: `jsonish/src/parser.ts:1348-1383`

**Enhancement**: When schema expects array but object is provided, wrap object in array:
```typescript
// In array coercion logic
if (value.type === 'object' && schema instanceof z.ZodArray) {
  // Try wrapping single object in array
  const wrappedValue = { type: 'array', items: [value], completion: 'complete' };
  return coerceArray(wrappedValue, schema, ctx);
}
```

### 3. Re-enable Fixed Functions (Low Priority)

**Location**: `jsonish/src/fixing-parser.ts:44-46`

- Re-enable `fixUnquotedKeys()` and `fixComplexUnquotedValues()` after implementing duplicate key handling
- Test thoroughly to ensure no regressions with the enhanced object coercion

### 4. State Machine Enhancement (Future)

**Location**: `jsonish/src/state-machine.ts`

- Implement Rust-style context-aware boundary detection
- Add completion state tracking for streaming support
- Enhance content truncation logic for malformed embedded structures

## Open Questions

1. **Performance Impact**: How will duplicate key detection affect parsing performance on large objects?
2. **Schema Validation**: Should duplicate key consolidation happen before or after Zod schema validation?
3. **Backward Compatibility**: Will fixing duplicate key handling break existing code that relies on "last value wins" behavior?
4. **Edge Cases**: How should the parser handle mixed array/object duplicates (e.g., first value is object, second is array)?

## Test Coverage Requirements

**Essential Test Cases**:
- Duplicate keys with same types → array consolidation
- Duplicate keys with mixed types → type coercion
- Malformed JSON with embedded duplicate keys
- Schema validation with consolidated arrays
- Regression testing for existing object/array coercion

**File**: `test/basics.test.ts:949` should pass after implementing duplicate key handling with proper object-to-array wrapping when schema expects arrays.