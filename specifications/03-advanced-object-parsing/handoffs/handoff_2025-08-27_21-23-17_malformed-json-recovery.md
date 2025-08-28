---
date: 2025-08-27T21:23:17-05:00
researcher: Claude
git_commit: 59f8f8ca2ef477e2e773c76a7a7f3bbe12cc9fd3
branch: master
repository: jsonish
topic: "Malformed JSON with Embedded Structures Recovery Implementation"
tags: [implementation, malformed-json, json-fixing, duplicate-keys, array-collection]
status: partially_complete
last_updated: 2025-08-27
last_updated_by: Claude
type: implementation_strategy
---

# Handoff: Malformed JSON with Embedded Structures Recovery

## Task(s)

**Primary Task**: Fix failing test `should handle complex malformed JSON sequence` in `test/basics.test.ts:949`
- **Status**: Work in progress - core fixes implemented but blocked by JSON corruption issues
- **Expected Behavior**: Parser should handle malformed JSON like `"field13": null{...}` and convert embedded structures to escaped string content
- **Current Issue**: Test fails with "expected object, received string" due to parser falling back to string strategy

## Recent Changes

1. **Added `fixMalformedValueStructures()` function** in `jsonish/src/fixing-parser.ts:449-498`
   - Handles patterns like `"field": null,{...}` → `"field": "null{...}"`
   - Properly escapes quotes, newlines, and special characters for valid JSON strings
   - Successfully tested in isolation

2. **Enhanced `fixMissingCommasBeforeDelimiters()` function** in `jsonish/src/fixing-parser.ts:500-514`
   - Fixes patterns like `null{` → `null,{`
   - Handles quoted strings, numbers, booleans followed by delimiters

3. **Added early return optimization** in `fixJson()` at `jsonish/src/fixing-parser.ts:39-46`
   - Returns immediately if JSON becomes valid after critical fixes
   - Prevents further corruption by downstream fixing functions

4. **Implemented duplicate key handling logic** (currently reverted to avoid breaking other tests)
   - Located in `coerceObject()` function around `jsonish/src/parser.ts:1184`
   - Collects duplicate keys into arrays when schema expects arrays (e.g., multiple `foo2` keys → single `foo2` array)

## Learnings

### Root Cause Analysis
- **Primary Issue**: Existing JSON fixing functions (`fixComplexUnquotedValues`, `fixUnquotedKeys`) corrupt valid JSON structures
- **Evidence**: Input `"foo1": {` becomes `"foo1\": {` (unterminated string)
- **Impact**: Causes markdown extraction strategy to fail, forcing parser to use string fallback

### Test Case Understanding
- **Expected Result**: `field13` should contain string `'null{\n"foo1": {\n"field1": "A thing has been going on poorly"'`
- **Parser Strategy**: Malformed embedded JSON should be treated as string content, not parsed as separate objects
- **Schema Requirement**: `foo2` field expects array type, requiring duplicate key collection

### Working Solutions Demonstrated
- Manual testing in `test_fix_function.js` proves fixes work correctly in isolation
- `fixMalformedValueStructures()` successfully converts malformed patterns to valid JSON strings
- Missing comma recovery works for `null{` patterns

## Artifacts

### Implementation Files
- `jsonish/src/fixing-parser.ts` - Contains new fixing functions and modifications
- `jsonish/src/parser.ts` - Contains duplicate key handling logic (currently reverted)

### Debug and Test Files
- `debug_test.js` - Main debugging script for reproduction and testing
- `test_fix_function.js` - Isolated testing of fixing functions (proves they work)
- `final_verification.js` - Validates expected test output matches schema
- `test_without_fixjson.js` - Demonstrates parser works with valid JSON

### Analysis Documents
- `specifications/03-advanced-object-parsing/thoughts/malformed-json-with-embedded-structures-debug.md` - Comprehensive analysis of the failing test case

## Action Items & Next Steps

### Critical - High Priority
1. **Refactor `fixComplexUnquotedValues()` function** in `jsonish/src/fixing-parser.ts:216-299`
   - Fix string quote parsing logic at lines 249-255 (incorrect termination condition)
   - Prevent corruption of valid JSON structures like `"key": {`
   - Test thoroughly to avoid regressions

2. **Refactor `fixUnquotedKeys()` function** in `jsonish/src/fixing-parser.ts:180-214`
   - Investigate why it corrupts quoted keys
   - Ensure it only processes actually unquoted keys

### Implementation
3. **Re-implement duplicate key handling** in `jsonish/src/parser.ts:1184`
   - Apply the logic from git diff (previously working)
   - Collect duplicate keys into arrays when schema expects arrays
   - Test carefully to avoid breaking other test cases

4. **Integration testing**
   - Ensure all fixes work together without conflicts
   - Run full test suite to prevent regressions
   - Specifically test the target case: `bun test ./test/basics.test.ts --grep "should handle complex malformed JSON sequence"`

### Verification
5. **Validate extraction strategy success**
   - Ensure markdown extraction finds and processes the fixed JSON correctly
   - Verify coercion of extracted values succeeds
   - Confirm final result matches expected test output

## Other Notes

### Key File Locations
- **Main parser logic**: `jsonish/src/parser.ts` (coerceObject function around line 1140)
- **JSON fixing functions**: `jsonish/src/fixing-parser.ts` 
- **Value extraction**: `jsonish/src/extractors.ts` (extractMarkdownCodeBlocks function)
- **Coercion logic**: `jsonish/src/coercer.ts`

### Critical Understanding
- The parser uses a 7-strategy approach: standard JSON → markdown extraction → JSON fixing → state machine → text extraction → partial parsing → string fallback
- Success requires the markdown extraction strategy (strategy 2) to work properly
- The test case is specifically designed to validate recovery from severely malformed JSON with embedded structures

### Testing Strategy
- Use `debug_test.js` for comprehensive debugging and reproduction
- Use `test_fix_function.js` to validate individual fixing functions work correctly
- The target test expects exactly: `{foo1: object, foo2: [object], foo3: object}` where `foo2[0].field13` contains the malformed content as a string

### Git Status
- Current modifications in `jsonish/src/fixing-parser.ts` contain the new fixes
- `jsonish/src/parser.ts` has been reverted to avoid breaking other tests
- Several debug files created but not committed to version control