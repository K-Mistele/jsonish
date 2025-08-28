---
date: 2025-08-28T16:28:40-05:00
researcher: Claude
git_commit: 91c9c585595d14280f4fdd40665af96f363dcc17
branch: master
repository: jsonish
topic: "Unescaped Quotes JSON Parser Fix Implementation Strategy"
tags: [implementation, strategy, json-parser, string-handling, test-fixes]
status: complete
last_updated: 2025-08-28
last_updated_by: Claude
type: implementation_strategy
---

# Handoff: JSONish Parser Unescaped Quotes Fix

## Task(s)

**Primary Task: Fix failing test "should handle string with unescaped quotes"**
- Status: **Work in Progress** - Root cause identified, but implementation introduced regressions
- Location: `test/class.test.ts:210-226`
- Issue: Test fails with `ZodError: Invalid input: expected object, received string`

The test expects the parser to handle malformed JSON containing unescaped quotes within string values:
```typescript
const input = '{ rec_one: "and then i said \\"hi\\", and also \\"bye\\"", rec_two: "and then i said "hi", and also "bye"", "also_rec_one": ok }';
```

## Recent Changes

**Changes Made (with regressions introduced):**
1. **Added `fixMixedQuotes` to parsing pipeline** - `jsonish/src/fixing-parser.ts:29`
2. **Enhanced `fixUnquotedKeys` function** - Added comma trigger support at `jsonish/src/fixing-parser.ts:186`
3. **Implemented aggressive string boundary detection** - Completely rewrote `fixMixedQuotes` function with double-quote pattern detection
4. **Enabled additional quote fixing** - Integrated previously disabled functions

**Current State:** All changes have been partially reverted due to 36 test regressions (vs original 1 failing test).

## Learnings

### Root Cause Analysis

**Primary Issue:** The `fixMixedQuotes` function exists in the codebase but was never integrated into the main `fixJson` pipeline at `jsonish/src/fixing-parser.ts:28-30`.

**Secondary Issues:**
1. **Unquoted key detection incomplete:** `fixUnquotedKeys` only triggers on `{` or whitespace, missing comma-separated keys like `, rec_two:`
2. **String boundary detection complex:** The malformed JSON `"and then i said "hi", and also "bye""` has nested unescaped quotes that confuse simple quote-counting algorithms
3. **Pipeline order sensitivity:** The order of fixes in the pipeline affects outcomes significantly

### Technical Deep Dive

**Parser Flow Analysis:**
1. **Strategy 1** (JSON.parse): Fails on malformed input ✓ Expected
2. **Strategy 2** (extractJsonFromText): Doesn't apply to object parsing ✓ Expected  
3. **Strategy 3** (fixJson): Should fix the malformed JSON but `fixMixedQuotes` not called ❌ **Root cause**
4. **Strategy 4** (parseWithAdvancedFixing): State machine also fails on this pattern ❌
5. **Strategy 5-6**: Don't apply
6. **Strategy 7** (String fallback): Returns input as string instead of parsed object ❌ **Symptom**

**Critical Files:**
- `jsonish/src/fixing-parser.ts:4-59` - Main `fixJson` function pipeline
- `jsonish/src/fixing-parser.ts:300-351` - `fixMixedQuotes` implementation (exists but unused)
- `jsonish/src/fixing-parser.ts:163-218` - `fixUnquotedKeys` function (incomplete comma handling)
- `jsonish/src/parser.ts:23-33` - Main parsing strategy controller

### Regression Analysis

**Code block parsing severely impacted:** 19 failing tests in `test/code.test.ts` due to aggressive string processing
**Streaming tests affected:** Complex JSON structures broken due to over-eager quote escaping
**String handling disrupted:** Triple quotes, backticks, and markdown extraction corrupted

## Artifacts

**Modified Files:**
- `jsonish/src/fixing-parser.ts` - Main implementation file with pipeline and quote fixing functions
- Multiple debug files created and cleaned up during investigation

**Test Files Analyzed:**
- `test/class.test.ts:210-226` - Primary failing test case
- `test/code.test.ts` - Regression test suite (19 failures introduced)
- `test/streaming.test.ts` - Additional regression tests

**Debug Artifacts Created/Removed:**
- `debug-*.js` files - Temporary debugging scripts for isolating issues (cleaned up)

## Action Items & Next Steps

### Immediate Priority: Conservative Fix Implementation

**Step 1: Minimal Integration Approach**
- Add **original** `fixMixedQuotes` function to pipeline at `jsonish/src/fixing-parser.ts:29`
- **DO NOT** enhance the function initially - use existing implementation
- Test impact on original failing test and regression suite

**Step 2: Targeted `fixUnquotedKeys` Enhancement**
- Modify trigger condition at `jsonish/src/fixing-parser.ts:186` to include comma: `if (char === '{' || char === ',' || /\s/.test(char))`
- Test this change in isolation

**Step 3: Incremental Testing Strategy**
- Test each change individually before combining
- Run full test suite after each modification: `bun run tests`
- Focus on preventing regressions in `test/code.test.ts` and `test/streaming.test.ts`

**Step 4: String Boundary Detection Refinement**
- If basic integration doesn't work, enhance `fixMixedQuotes` with **conservative** string boundary detection
- Focus specifically on the pattern: `"text "embedded quotes" more text"`
- Avoid over-processing valid strings

### Alternative Approaches to Consider

**Option A: Pipeline Order Adjustment**
- Try calling `fixMixedQuotes` earlier in pipeline (before `fixArrayElements`)
- May resolve boundary detection issues

**Option B: Targeted Pattern Matching**
- Create specific regex for the exact failing pattern: `"[^"]*"[^"]*"[^"]*"`
- Less likely to cause regressions than general-purpose quote fixing

**Option C: Parser Strategy Enhancement**
- Consider enhancing Strategy 4 (parseWithAdvancedFixing) instead of Strategy 3
- State machine might handle complex quote patterns better

## Other Notes

### Testing Commands
- **Specific failing test:** `bun test ./test/class.test.ts -t "should handle string with unescaped quotes"`
- **Full regression check:** `bun run tests`
- **Code block tests:** `bun test ./test/code.test.ts`

### Key Code Patterns to Preserve
- **Triple quote handling:** Critical for code block extraction
- **Backtick processing:** Used extensively in markdown parsing  
- **Streaming JSON:** Partial object completion must not be disrupted

### Reference Implementation
The original BAML Rust implementation likely handles this case - consider reviewing patterns from there if available.

### Performance Considerations
The current failing test represents a realistic LLM output pattern, so fixing this enhances real-world usability significantly.

### Risk Assessment
- **High regression risk** if changes are too broad
- **Medium complexity** - string parsing with nested quotes is inherently complex
- **High value** - fixes common LLM output malformation pattern