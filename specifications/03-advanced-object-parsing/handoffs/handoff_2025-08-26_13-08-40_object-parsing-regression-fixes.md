---
date: 2025-08-26T13:08:40-05:00
researcher: Claude Code
git_commit: a8da24ccf1b4bfa33f676b6229dba1db996f0a3e
branch: master
repository: jsonish
topic: "Object Parsing Regression Fixes Implementation"
tags: [implementation, object-parsing, nullable-schemas, recursive-objects, json-extraction, coercion, zod, regression-fixes]
status: partially_complete
last_updated: 2025-08-26
last_updated_by: Claude Code
type: implementation_strategy
---

# Handoff: Object Parsing Regression Fixes Implementation

## Task(s)

**Primary Task: Fix Object Parsing Test Failures** - **PARTIALLY COMPLETE**
- ✅ **COMPLETED**: Fix null handling regression in ZodNullable schema handler
- ✅ **COMPLETED**: Remove inappropriate string conversions in coercer
- ✅ **COMPLETED**: Add string-to-object coercion capability  
- ✅ **COMPLETED**: Restore proper string fallback behavior
- ❌ **REMAINING**: Fix JSON extraction algorithm for incomplete nested objects (6 failing tests)
- ❌ **REMAINING**: Fix unescaped quotes in string parsing (2 failing tests)

**Status**: 41/49 tests passing (83% success rate). Major regressions fixed, complex edge cases remain.

## Recent Changes

### Core Regression Fixes (Commit: a8da24c)

**1. Fixed Null Handling in ZodNullable Schemas** (`jsonish/src/parser.ts:567-585`)
```typescript
// BEFORE: Tried inner type coercion first, causing null -> "null" conversion
if (schema instanceof z.ZodNullable) {
  try {
    return coerceValue(value, schema._def.innerType, ctx);
  } catch {
    return null as z.infer<T>;
  }
}

// AFTER: Check for actual null values first
if (schema instanceof z.ZodNullable) {
  // Check for actual null Values first
  if (value.type === 'null') {
    return null as z.infer<T>;
  }
  // Then try coercing to inner type
  try {
    return coerceValue(value, schema._def.innerType, ctx);
  } catch {
    return null as z.infer<T>;
  }
}
```

**2. Removed Inappropriate String Conversions** (`jsonish/src/coercer.ts:12-15`)
```typescript
// REMOVED: These cases that were causing null -> "null" conversion
case 'null':
  return 'null';
case 'object':
  // Convert object to TypeScript interface-like string representation
  [complex object stringification logic]

// REPLACED WITH: Fall through to error for inappropriate conversions
case 'object':
case 'null':
  // Fall through to error for inappropriate conversions
```

**3. Added String-to-Object Coercion** (`jsonish/src/parser.ts:759-784`)
```typescript
// NEW: Handle string values that might contain JSON objects
if (value.type === 'string') {
  const trimmed = value.value.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const objectValue = createValueFromParsed(parsed);
        return coerceObject(objectValue, schema, newCtx);
      }
    } catch {
      // Try fixing parser if JSON.parse fails
      [fallback logic with JSON fixing]
    }
  }
}
```

## Learnings

### Critical Root Cause Analysis

**1. Null Value Handling Regression**
- **Root Cause**: `ZodNullable` handler at `jsonish/src/parser.ts:566-579` had incorrect logic order
- **Mechanism**: When processing `{ type: 'null' }` Values, tried inner type coercion first → triggered `coerceToString` → converted null to `"null"` string
- **Impact**: All nullable fields received `"null"` strings instead of actual `null` values
- **Fix Location**: `jsonish/src/parser.ts:567-585` - reordered logic to check `value.type === 'null'` first

**2. Aggressive String Conversion Issues**
- **Root Cause**: `coerceToString` at `jsonish/src/coercer.ts:12-21` had inappropriate conversions for null and object types
- **Mechanism**: Added in recent commits (303ac543, d9c19bd6) - `case 'null': return 'null';` and object-to-TypeScript conversion
- **Impact**: Corrupted type coercion throughout the system
- **Fix Location**: `jsonish/src/coercer.ts:12-15` - removed inappropriate case handlers

**3. String Fallback Coercion Gap**
- **Root Cause**: `coerceObject` didn't handle string values containing JSON
- **Mechanism**: String fallback created `{type: 'string', value: '{"key": "value"}'}` but object coercion expected `type: 'object'`
- **Impact**: `ZodError: expected object, received string` when string fallback was used
- **Fix Location**: `jsonish/src/parser.ts:759-784` - added string-to-JSON parsing in object coercion

### Complex Issues Requiring Further Work

**4. JSON Extraction Algorithm Flattening** - **CRITICAL UNFIXED ISSUE**
- **Root Cause**: `extractJsonFromText()` in `jsonish/src/extractors.ts` incorrectly handles incomplete nested objects
- **Specific Problem**: Input `{ "pointer": { pointer: null,` → Extracts `{pointer: null}` instead of `{pointer: {pointer: null}}`
- **Mechanism Analysis**:
  ```javascript
  // INPUT: The answer is { "pointer": { pointer: null, } Anything else?
  
  // SHOULD EXTRACT:
  { "pointer": { "pointer": null } }  // Proper nested structure
  
  // ACTUALLY EXTRACTS:
  { 
    "pointer": null,                     // Flattened - missing nested object
    "Anything else I can help with?": null  // Wrong - text treated as field
  }
  ```
- **Impact**: 6 failing tests - all recursive object structures get flattened
- **Files Involved**: 
  - `jsonish/src/extractors.ts` - JSON extraction algorithm
  - `jsonish/src/state-machine.ts` - Advanced state machine parser (also affected)
  - Strategy execution order in `jsonish/src/parser.ts:15-115`

**5. Unescaped Quotes in JSON Strings** - **COMPLEX UNFIXED ISSUE**
- **Root Cause**: JSON fixing and state machine parsing fail on embedded unescaped quotes
- **Specific Problem**: `'{ rec_two: "and then i said "hi", and also "bye"" }'` - unescaped quotes break parsing
- **Mechanism**: 
  - Strategy 1 (JSON.parse): Fails as expected
  - Strategy 2 (extraction): Succeeds but with wrong field parsing due to quote confusion  
  - Strategy 3 (JSON fixing): Makes JSON worse instead of better
  - Strategy 4 (state machine): Returns string instead of object
  - Strategies 5-6: Fail
  - Strategy 7 (string fallback): Triggers "expected object, received string" error
- **Impact**: 2 failing tests with complex quote patterns
- **Files Involved**:
  - `jsonish/src/fixing-parser.ts` - JSON fixing logic needs quote handling improvement
  - `jsonish/src/state-machine.ts` - State machine should handle this but doesn't

### Parser Strategy Flow Analysis

**Strategy Execution Order** (`jsonish/src/parser.ts:15-115`):
1. **Strategy 1**: `JSON.parse()` - Standard JSON parsing
2. **Strategy 2**: `extractJsonFromText()` - **PROBLEMATIC** - Succeeds with wrong structure for incomplete objects
3. **Strategy 3**: JSON fixing with `fixJson()` - **NEEDS IMPROVEMENT** - Makes some cases worse
4. **Strategy 4**: `parseWithAdvancedFixing()` - **INCONSISTENT** - Sometimes returns string instead of object
5. **Strategy 5**: `extractFromText()` - Schema-based text extraction
6. **Strategy 6**: `parsePartialValue()` - Only if `allowPartial` enabled (not used in tests)
7. **Strategy 7**: String fallback - **FIXED** - Now works correctly

**Key Insight**: Strategy 2 succeeds early with incorrect results, preventing more robust strategies (4, 6) from running.

## Artifacts

### Implementation Documents
- `specifications/03-advanced-object-parsing/research/research_2025-08-26_17-43-14_object-parsing-test-failures.md` - **PRIMARY REFERENCE** - Comprehensive root cause analysis that guided these fixes

### Test Files & Status
- `test/class.test.ts` - Object parsing tests (41/49 passing)
  - Lines 210-226: Unescaped quotes test (failing)
  - Lines 703-729: Recursive object tests (6 tests failing due to extraction algorithm)
  - Lines 323+: Nullable field test (now passing ✅)

### Modified Core Files
- `jsonish/src/parser.ts` - Main parser with strategy execution and coercion logic
  - Lines 567-585: Fixed ZodNullable handling
  - Lines 759-784: Added string-to-object coercion
  - Lines 507-523: Lazy schema handling (reverted complex fix, working correctly)
- `jsonish/src/coercer.ts` - Type coercion functions
  - Lines 12-15: Removed inappropriate null/object string conversions
- `jsonish/src/index.ts` - Parser interface and options

### Problematic Files Requiring Work
- `jsonish/src/extractors.ts` - **NEEDS MAJOR WORK** - JSON extraction algorithm has fundamental issues with nested objects
- `jsonish/src/fixing-parser.ts` - **NEEDS IMPROVEMENT** - JSON fixing makes some cases worse
- `jsonish/src/state-machine.ts` - **NEEDS INVESTIGATION** - Sometimes returns string when object expected

## Action Items & Next Steps

### High Priority - JSON Extraction Algorithm Fix
1. **Investigate and fix `extractJsonFromText()` in `jsonish/src/extractors.ts`**
   - **Problem**: Flattens incomplete nested objects instead of preserving structure
   - **Debug approach**: 
     ```bash
     # Test specific failing pattern:
     Input: `{ "pointer": { pointer: null,`
     Expected: Extract `{pointer: {pointer: null}}`  
     Actual: Extracts `{pointer: null}`
     ```
   - **Files to examine**: 
     - `jsonish/src/extractors.ts` - Main extraction logic
     - Look for object boundary tracking and nested structure handling
   - **Impact**: Will fix 6 failing recursive object tests

### Medium Priority - State Machine Parser Investigation  
2. **Fix state machine parser returning strings instead of objects**
   - **Problem**: `parseWithAdvancedFixing()` returns `{type: "string"}` for JSON-like inputs
   - **Expected**: Should return `{type: "object"}` with parsed structure
   - **Debug command**: Test with incomplete JSON inputs in `jsonish/src/state-machine.ts`
   - **Impact**: Would provide more robust parsing for malformed JSON

### Medium Priority - JSON Fixing Enhancement
3. **Improve JSON fixing for unescaped quotes in strings**
   - **Problem**: `fixJson()` in `jsonish/src/fixing-parser.ts` makes JSON worse for embedded quotes
   - **Specific case**: `'{ rec_two: "and then i said "hi", and also "bye"" }'`
   - **Approach**: Need smarter quote escaping logic that preserves string content
   - **Impact**: Will fix 2 failing string parsing tests

### Alternative Approaches to Consider
4. **Strategy reordering for incomplete JSON**
   - **Option**: Modify strategy conditions to prefer partial parsing (Strategy 6) for incomplete-looking JSON
   - **Location**: `jsonish/src/parser.ts:15-115` - strategy execution logic
   - **Benefit**: Could bypass extraction algorithm issues for incomplete cases

5. **Detection-based strategy selection**
   - **Option**: Add detection logic to identify when JSON extraction results look suspicious (non-schema fields, text-like field names)
   - **Benefit**: Could fall back to more robust strategies when extraction gives questionable results

## Other Notes

### Test Validation Commands
```bash
# Run all object tests
bun test test/class.test.ts

# Run specific failing test patterns
bun test test/class.test.ts -t "recursive object"
bun test test/class.test.ts -t "unescaped quotes"
```

### Key Architecture Insights
- **Value System**: Internal representation in `jsonish/src/value.ts` works correctly
- **Lazy Schema Handling**: Works correctly for legitimate recursive cases, issues are in extraction phase
- **Nullable Support**: Now working correctly after fixes
- **Coercion System**: Properly handles type conversions except for extraction algorithm gaps

### Related Research & Context
- **Original Rust Implementation**: `baml/engine/baml-lib/jsonish/src/deserializer/` - Reference for proper algorithms
- **Recent Regression Commits**: 303ac543, d9c19bd6, 08dcb57 - Introduced the null handling issues that were fixed
- **Union Type Resolution Research**: `specifications/11-union-type-resolution/` - Related parsing work

### Performance Considerations
- Current fixes don't introduce performance regressions
- JSON extraction algorithm fixes may need performance validation for large inputs
- Circular reference tracking in lazy schemas works correctly and prevents infinite loops

### Debugging Tools Created (Removed)
Multiple debug scripts were created and removed during investigation:
- `debug-recursive-specific.ts` - Isolated recursive parsing issue
- `debug-extraction-specific.ts` - Analyzed JSON extraction behavior  
- `debug-complete-vs-incomplete.ts` - Compared complete vs incomplete JSON handling

These can be recreated as needed for continued debugging using similar patterns.