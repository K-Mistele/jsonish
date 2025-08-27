---
date: 2025-08-27T20:34:36+0000
researcher: Claude Code
git_commit: 58961d7b7b2941a0c31d910a3fcdb1f29731039e
branch: master
repository: jsonish
topic: "Deep Analysis of Test Failures: Understanding What's Broken and Why Our Implementation Differs from Rust"
tags: [research, codebase, parser, deserializer, coercer, streaming, partial-parsing, union-resolution, error-recovery, type-coercion, rust-comparison]
status: complete
last_updated: 2025-08-27
last_updated_by: Claude Code
type: research
---

# Research: Deep Analysis of Test Failures - Root Causes and Rust Implementation Comparison

**Date**: 2025-08-27T20:34:36+0000  
**Researcher**: Claude Code  
**Git Commit**: 58961d7b7b2941a0c31d910a3fcdb1f29731039e  
**Branch**: master  
**Repository**: jsonish

## Research Question
What is broken in the JSONish parser codebase, where is it broken, what code is affected, how does the original Rust implementation work, and why doesn't our TypeScript implementation handle these cases properly?

## Summary
This research reveals that 5 critical test failures stem from fundamental architectural differences between the original Rust implementation and our TypeScript port. The failures are caused by:

1. **Over-aggressive array collection** that violates partial parsing boundaries
2. **Conservative string parsing** that falls back too early instead of fixing malformed objects  
3. **Union resolution issues** caused by enhanced caching interfering with recursive types
4. **Missing completion state propagation** in the Value system
5. **Architectural paradigm mismatches** between Rust's enum-based pattern matching and TypeScript's object-oriented approach

The root cause is that our TypeScript port lacks the sophisticated error recovery, completion state tracking, and union resolution algorithms present in the Rust implementation.

## Detailed Findings

### 1. Parser System Architecture Issues

**Recent Breaking Changes:**
- **Array Collection Strategy** (`jsonish/src/parser.ts:78-105`) - New logic collects ALL objects before validation, preventing partial arrays from being empty
- **Union Resolution Order** (`jsonish/src/parser.ts:915-921`) - Changed to process `ZodDiscriminatedUnion` before `ZodUnion`, affecting recursive type resolution  
- **Enhanced Caching** (`jsonish/src/parser.ts:1419-1427`) - Modified object hash calculation includes field values, causing incorrect cache hits for similar structures
- **State Machine Changes** (`jsonish/src/state-machine.ts:340-395`) - Modified `null{...}` pattern handling to be more conservative, leading to string fallback instead of object parsing

**Critical Architecture Gap:**
The TypeScript implementation uses a 6-strategy fallback system but lacks the sophisticated error recovery present in the Rust implementation's multi-strategy approach. The Rust parser preserves multiple parsing possibilities via `Value::AnyOf(Vec<Value>, String)`, while TypeScript commits to single interpretations too early.

### 2. Type Coercion and Union Resolution Failures

**Union Resolution Problems:**
- **Cache Pollution** - Global `unionResultCache` doesn't properly account for schema differences in recursive contexts
- **Scoring Inconsistencies** - Basic scoring (100 points for exact match, 10-50 for coercion) lacks sophisticated heuristics present in Rust's `pick_best()` algorithm
- **Recursion Detection Issues** - Simple recursion protection interferes with legitimate recursive data structures

**Specific Failing Behavior:**
In recursive union test case, `{rec_one: 1, rec_two: 2}` gets coerced to `{rec_one: true, rec_two: false}` because enhanced caching returns previous result for similar object structure but different schema context.

**Root Cause:** TypeScript implementation lacks Rust's two-phase approach (`try_cast` vs `coerce`) and sophisticated scoring with context awareness.

### 3. Value Representation System Gaps

**Critical Missing Feature:** The `createValueFromParsed()` function (`jsonish/src/value.ts:38-61`) **always creates Values with `Complete` status**, losing partial parsing information.

**Architecture Issues:**
- All parsing strategies convert to Values via `createValueFromParsed()` without streaming context
- State machine parser creates Values directly but doesn't leverage completion states effectively
- `parseIncompleteJson()` can parse partial structures but resulting Values are marked as `Complete`
- Cache system includes completion state in hash keys, but since all Values are marked Complete, differentiation is lost

**Impact:** Tests expect `{nums: [1]}` from input `"{'nums': [1,2"` but get `{nums: [1,2]}` because auto-closing creates Complete Values instead of Incomplete ones.

### 4. Original Rust Implementation Architecture

**Sophisticated State Machine:**
The Rust implementation uses a complex `JsonParseState` with position-aware context tracking:
- `InNothing`, `InObjectKey`, `InObjectValue`, `InArray` - Determines string boundary rules
- Sophisticated lookahead analysis for string termination
- Comment parsing support (`//`, `/*`) 
- Triple-backtick code block handling

**Advanced Union Resolution:**
```rust
// Rust array_helper::pick_best() with sophisticated heuristics
- SingleToArray flags: De-prioritizes arrays created from single values
- Markdown string detection: Prefers parsed content over raw markdown  
- Default value detection: De-prioritizes objects with only defaults
- ImpliedKey detection: De-prioritizes objects with coerced string fields
```

**Value System with Completion State:**
```rust
pub enum Value {
    String(String, CompletionState),
    Object(Vec<(String, Value)>, CompletionState),
    Array(Vec<Value>, CompletionState), 
    AnyOf(Vec<Value>, String),           // Multiple parsing options
    FixedJson(Box<Value>, Vec<Fixes>),   // Auto-fixed JSON with fix tracking
}
```

**Key Insight:** Rust's `AnyOf` type preserves multiple parsing possibilities, allowing downstream coercion to choose the best match. TypeScript lacks this capability.

### 5. Failing Test Case Analysis

#### Partial Array Tests (2 failures)
- **Expected:** `{ three_small_things: [] }` for incomplete array elements
- **Actual:** `{ three_small_things: [{ i_16_digits: 123, i_8_digits: 0 }] }` 
- **Root Cause:** Array collection logic doesn't respect `allowPartial: true` boundaries

#### String Quote Handling (1 failure)  
- **Input:** Objects with unescaped quotes that should be fixable
- **Expected:** Proper quote extraction and object parsing
- **Actual:** `ZodError: "expected object, received string"`
- **Root Cause:** State machine changes made parser less aggressive about fixing malformed objects

#### Recursive Object Parsing (1 failure)
- **Expected:** `{ rec_one: { rec_one: 1, rec_two: 2 } }` (preserve number types)
- **Actual:** `{ rec_one: { rec_one: true, rec_two: false } }` (incorrect boolean coercion)
- **Root Cause:** Enhanced union caching causing incorrect cache hits for recursive structures

#### Partial Resume Parsing (1 failure)
- **Expected:** Parse available fields from incomplete objects
- **Actual:** `ZodError: "expected object, received string"`
- **Root Cause:** Parser treating partial objects as malformed strings instead of incomplete objects

### 6. Architectural Paradigm Differences

**Language-Level Mismatches:**
1. **Type Systems:** Rust enum variants with pattern matching vs TypeScript discriminated unions with type guards
2. **Error Handling:** Rust `Result<T, E>` propagation vs TypeScript exceptions changing control flow
3. **Memory Management:** Rust ownership enabling zero-copy parsing vs TypeScript GC creating different performance patterns
4. **Value Representation:** Rust stack-allocated enum variants vs TypeScript heap-allocated objects

**Critical Design Decision:** The TypeScript port attempts to replicate Rust's enum-based pattern matching in an object-oriented type system, leading to behavioral divergences.

## Code References

### Parser Architecture
- `jsonish/src/index.ts:15-35` - Main API entry points with strategy selection
- `jsonish/src/parser.ts:65-153` - 6-strategy fallback system implementation
- `jsonish/src/parser.ts:78-105` - **BROKEN: Array collection logic violating partial boundaries**
- `jsonish/src/parser.ts:915-921` - **BROKEN: Union resolution order affecting recursive types**
- `jsonish/src/parser.ts:1419-1427` - **BROKEN: Enhanced caching causing incorrect cache hits**

### State Machine and Fixing
- `jsonish/src/state-machine.ts:340-395` - **BROKEN: Conservative null{} pattern handling**  
- `jsonish/src/fixing-parser.ts:45-67` - JSON auto-fixing implementation
- `jsonish/src/extractors.ts:89-120` - JSON extraction from mixed content

### Value System
- `jsonish/src/value.ts:38-61` - **BROKEN: createValueFromParsed() always marks Complete**
- `jsonish/src/value.ts:1-12` - CompletionState definition and Value types

### Type Coercion
- `jsonish/src/coercer.ts:434-453` - String quote handling logic
- `jsonish/src/parser.ts:1709-1785` - Union coercion with caching 
- `jsonish/src/parser.ts:2056-2240` - Union scoring system
- `jsonish/src/parser.ts:1293-1375` - Array coercion and error recovery

### Test Cases
- `test/class-2.test.ts:705-718` - Partial streaming container test (FAILING)
- `test/class-2.test.ts:721-775` - Partial semantic container test (FAILING)
- `test/class.test.ts:210-225` - String with unescaped quotes test (FAILING)
- `test/class.test.ts:946-996` - Complex recursive structure test (FAILING)
- `test/class.test.ts:1103-1134` - Partial resume parsing test (FAILING)

### Original Rust Implementation
- `baml/engine/baml-lib/jsonish/src/jsonish/parser/entry.rs:244` - Main parse function with is_done parameter
- `baml/engine/baml-lib/jsonish/src/deserializer/coerce_union.rs` - Sophisticated union coercion
- `baml/engine/baml-lib/jsonish/src/deserializer/array_helper.rs` - Advanced array element selection
- `baml/engine/baml-lib/jsonish/src/jsonish/parser/json_parse_state.rs` - Complex state machine

## Parser Flow Analysis

### Current TypeScript Flow (Broken)
```
Input → parseBasic() → Strategy Selection → Value Creation (Always Complete) → Coercion → Output
                    ↓
             [Strategy 1-6] - Array collection violates partial boundaries
                    ↓                    
             Union Resolution - Enhanced caching causes incorrect matches
                    ↓
             String Fallback - Too conservative, avoids object fixing
```

### Rust Implementation Flow (Working)
```
Input → parse(is_done) → Multi-Strategy → Value::AnyOf Creation → Sophisticated Coercion → simplify(is_done)
                       ↓
                  Position-Aware State Machine
                       ↓
                  Completion State Tracking
                       ↓  
                  Advanced Union Resolution (pick_best)
                       ↓
                  Context-Aware Error Recovery
```

## Architecture Insights

### Error Recovery Mechanisms
1. **Rust Approach:** Preserves original string in `AnyOf` for fallback, tracks applied fixes in `FixedJson` wrapper
2. **TypeScript Gaps:** Limited fix tracking, no original string preservation, commits to interpretations too early

### Type Coercion Patterns  
1. **Rust Sophistication:** Two-phase `try_cast`/`coerce` with flag-based scoring, considers type relationships
2. **TypeScript Limitations:** Single-phase coercion with basic scoring, missing context awareness

### Streaming/Partial Data Support
1. **Rust Design:** `is_done` parameter controls completion state, `simplify()` collapses options when streaming complete
2. **TypeScript Issues:** No streaming parameter, Values always marked Complete, partial boundaries not respected

### Zod Schema Integration  
1. **Current Problem:** Fighting against Zod validation instead of working with it
2. **Better Approach:** Preprocess values into Zod-compatible formats, reduce validation bypassing

## Related Documentation
- `debug_report.md` - Initial test failure analysis with error patterns
- `CLAUDE.md` - JSONish architecture and development guidelines  
- `specifications/requirements.md` - Original parser requirements (if exists)

## Open Questions
1. Should we implement Rust's `AnyOf` value type to preserve parsing options?
2. Can we add `is_done` streaming parameter throughout the parsing pipeline?
3. Should union resolution use separate `try_cast`/`coerce` phases like Rust?
4. How can we implement proper completion state propagation in TypeScript?
5. Is it feasible to rewrite the Value system to be more Rust-like?

## Recommendations

### Immediate Fixes (2-4 hours)
1. **Fix Array Collection:** Modify lines 78-105 in parser.ts to respect `allowPartial` boundaries - return empty arrays for incomplete elements
2. **Restore Object Parsing Aggressiveness:** Revert conservative string fallback in state-machine.ts lines 340-395
3. **Fix Union Caching:** Exclude recursive types from aggressive caching or implement recursion-aware cache keys

### Medium-term Improvements (1-2 days)  
1. **Implement Completion State Propagation:** Modify `createValueFromParsed()` to accept completion context
2. **Enhance Union Resolution:** Add sophisticated scoring with context awareness similar to Rust's `pick_best()`
3. **Improve Error Recovery:** Better handling of malformed JSON sequences without early string fallback

### Long-term Architecture (1-2 weeks)
1. **Add AnyOf Value Type:** Implement multi-option value representation for better union resolution
2. **Streaming Parameter:** Add `is_done` parameter throughout parsing pipeline for proper streaming support  
3. **Two-Phase Union Resolution:** Separate fast `try_cast` path from full `coerce` path with different caching strategies
4. **Enhanced State Machine:** Implement position-aware context tracking similar to Rust implementation

The core issue is that our TypeScript port prioritizes strict type safety over flexible error recovery, while the original Rust implementation balances both effectively through sophisticated completion state tracking and multi-option value representation.