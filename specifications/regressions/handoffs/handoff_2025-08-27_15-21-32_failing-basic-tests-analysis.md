---
date: 2025-08-27T15:21:32-05:00
researcher: Claude Code
git_commit: bcbd059c0318d66989e45a21e3d62b0f38422c4b
branch: master
repository: jsonish
topic: "Failing Basic Tests Analysis and Implementation Strategy"
tags: [implementation, strategy, parser, multi-object, malformed-json, array-coercion, regression-analysis]
status: complete
last_updated: 2025-08-27
last_updated_by: Claude Code
type: implementation_strategy
---

# Handoff: Failing Basic Tests Analysis and Implementation Strategy

## Task(s)

**Research Task - COMPLETED**: Analyze three failing basic test cases in the JSONish TypeScript parser to understand root causes and create implementation strategy:

1. ✗ `Basic Types > Object Parsing > should parse multiple top-level objects as array` - ANALYZED
2. ✗ `Basic Types > Object Parsing > should parse multiple objects with text as array` - ANALYZED  
3. ✗ `Basic Types > Partial/Malformed JSON > should handle complex malformed JSON sequence` - ANALYZED

**Implementation Task - PLANNED**: Fix the identified issues in parser strategy flow and malformed JSON recovery logic.

## Recent Changes

**Created Research Infrastructure**:
- Created `/specifications/regressions/` folder structure for regression analysis
- Generated comprehensive research document with detailed root cause analysis

**No Code Changes Made**: This was a pure research and analysis phase to understand the failures before implementation.

## Learnings

### Key Architectural Insight
The Rust BAML JSONish parser uses an `AnyOf` structure providing **multiple interpretation variants** (individual objects AND array of objects), letting the schema coercion layer choose the best match. The TypeScript port makes premature parsing decisions instead.

### Root Cause Analysis

**Issue 1 - Parser Strategy Early Return** (`jsonish/src/parser.ts:74-115`):
- Strategy 2 successfully extracts first object `{"key": "value1"}` 
- `coerceArray()` wraps it to `[{"key": "value1"}]` and returns early
- Multi-object collection logic at lines 118-140 never executes
- Should collect `[{"key": "value1"}, {"key": "value2"}]` instead

**Issue 2 - Multi-Object Logic Placement** (`jsonish/src/parser.ts:118-140`):
- Correct multi-object collection code exists but is unreachable
- Placed as fallback after Strategy 2, but Strategy 2 "succeeds" with single-object wrapping
- Logic should be integrated into Strategy 2 for array schemas

**Issue 3 - Malformed JSON Recovery Gap** (`jsonish/src/state-machine.ts:363-370`):
- `null{...}` pattern handler stops after first quoted string (key "foo1")
- Test expects continuation until first complete string value content
- Expected: `'null{\n"foo1": {\n"field1": "A thing has been going on poorly"'`
- Current: `'null{\n"foo1"'`

### Working Components Verified
- **JSON Extraction**: `extractMultipleObjects()` and `extractCompleteObjectsFromText()` work correctly
- **Array Schema Detection**: Properly identifies `z.ZodArray` schemas
- **Single-Object Wrapping**: `coerceArray()` function works as intended
- **Basic Malformed JSON Recovery**: Most fixing logic is robust

## Artifacts

**Research Document**: `/specifications/regressions/research_2025-08-27_15-17-00_failing-basic-tests.md`
- Comprehensive analysis of all three failing test cases
- Detailed code references with file:line locations
- Comparison with Rust implementation architecture  
- Specific implementation recommendations

**Test Files Analyzed**:
- `/test/basics.test.ts:408-414` - Multiple top-level objects test
- `/test/basics.test.ts:424-430` - Multiple objects with text test
- `/test/basics.test.ts:949-1112` - Complex malformed JSON test

**Handoff Document**: `/specifications/regressions/handoffs/handoff_2025-08-27_15-21-32_failing-basic-tests-analysis.md`

## Action Items & Next Steps

### Priority 1: Fix Parser Strategy Early Return
**File**: `jsonish/src/parser.ts:74-115`
**Action**: Modify Strategy 2 to collect ALL objects when target schema is `z.ZodArray` instead of returning after first object
**Implementation**: Add array schema check and multi-object collection before individual processing loop

### Priority 2: Fix Malformed JSON Recovery 
**File**: `jsonish/src/state-machine.ts:363-370`
**Action**: Modify `null{...}` pattern stopping condition to continue until first complete key-value pair
**Implementation**: Add context tracking for key vs value parsing, stop after complete string value

### Priority 3: Integration Testing
**Action**: Run `bun run tests` to verify fixes resolve all three failing test cases
**Validation**: Ensure no regression in existing passing tests

### Priority 4: Consider Architectural Enhancement
**Action**: Evaluate implementing `AnyOf` variant pattern from Rust for broader parsing improvements
**Context**: Current fixes are tactical; strategic alignment with Rust architecture may provide better long-term solution

## Other Notes

### Test Execution
- Use `bun run tests` instead of `bun test` to avoid accidentally including BAML codebase tests
- Current test failures show specific expected vs actual values that confirm the analysis

### Key File Locations
- **Parser Core**: `jsonish/src/parser.ts` - Multi-strategy parsing engine
- **Extractors**: `jsonish/src/extractors.ts` - JSON extraction from mixed content (working)
- **State Machine**: `jsonish/src/state-machine.ts` - Advanced parsing with malformed recovery
- **Coercion**: `jsonish/src/coercer.ts` - Zod integration and type coercion
- **Tests**: `test/basics.test.ts` - Comprehensive test suite with failing cases

### Rust Reference Implementation
- **Location**: `baml/engine/baml-lib/jsonish/src/` 
- **Key Insight**: Uses `multi_json_parser::parse()` with bracket-balanced detection
- **Strategy**: Creates array variants alongside individual object variants
- **Pattern**: `Value::AnyOf(variants, original_string)` for multiple interpretations

### Development Context
- **Runtime**: Uses Bun instead of Node.js for all operations
- **Schema System**: Zod-based validation and type coercion
- **Architecture**: Multi-strategy parsing with fallback mechanisms
- **Test Suite**: 236+ test cases, most passing, focus on these 3 regressions