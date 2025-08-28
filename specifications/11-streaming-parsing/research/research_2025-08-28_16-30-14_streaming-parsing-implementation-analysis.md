---
date: 2025-08-28T16:30:14-06:00
researcher: Claude Code
git_commit: 91c9c585595d14280f4fdd40665af96f363dcc17
branch: master
repository: jsonish
topic: "Streaming parsing implementation analysis and gaps"
tags: [research, codebase, streaming, partial-parsing, state-machine, rust-implementation, type-coercion]
status: complete
last_updated: 2025-08-28
last_updated_by: Claude Code
type: research
---

# Research: Streaming Parsing Implementation Analysis and Gaps

**Date**: 2025-08-28T16:30:14-06:00
**Researcher**: Claude Code
**Git Commit**: 91c9c585595d14280f4fdd40665af96f363dcc17
**Branch**: master
**Repository**: jsonish

## Research Question
Locate the original Rust implementation and understand it as well as the existing TypeScript codebase to understand what has been implemented and what needs to be added or changed to support streaming parsing, plus analyze failing tests for root cause analysis.

## Summary
The JSONish parser shows significant architectural differences between the Rust and TypeScript implementations regarding streaming/partial parsing. The TypeScript implementation has foundational streaming support but lacks critical features for production streaming scenarios. **11 out of 21 streaming/partial tests are failing** due to missing streaming state management, incomplete array parsing logic, and union resolution issues.

## Detailed Findings

### Rust Implementation Architecture

#### **Complete 6-Strategy Parsing System**
**Core Entry:** `/Users/kyle/Documents/Projects/jsonish/baml/engine/baml-lib/jsonish/src/jsonish/parser/entry.rs:15-242`

1. **Standard JSON** (lines 25-55): `serde_json::from_str()` with completion state handling
2. **Markdown Extraction** (lines 57-141): Code blocks with language tags
3. **Multi-JSON Objects** (lines 143-178): Multiple balanced JSON objects
4. **JSON Auto-fixing** (lines 180-228): State machine for malformed JSON  
5. **Schema-based Extraction**: Coercer handles text extraction
6. **String Fallback** (lines 230-239): Final coercion attempt

#### **Advanced State Machine with Streaming Support**
**Implementation:** `/Users/kyle/Documents/Projects/jsonish/baml/engine/baml-lib/jsonish/src/jsonish/parser/fixing_parser/json_parse_state.rs`

**Collection Stack Architecture:**
```rust
pub struct JsonParseState {
    pub collection_stack: Vec<(JsonCollection, Vec<Fixes>)>,
    pub completed_values: Vec<(&'static str, Value, Vec<Fixes>)>,
}
```

**Stream-Aware Collection Types:**
- `Object(Vec<String>, Vec<Value>, CompletionState)`  
- `Array(Vec<Value>, CompletionState)`
- `QuotedString(String, CompletionState)`
- `UnquotedString(String, CompletionState)` // handles numbers, bools, null

#### **Semantic Streaming Validation**
**System:** `/Users/kyle/Documents/Projects/jsonish/baml/engine/baml-lib/jsonish/src/jsonish/parser/semantic_streaming.rs:34-52`

- **Stream behavior annotations**: `@stream.done`, `@stream.not_null`, `@stream.with_state`
- **Completion tracking**: Attaches streaming metadata to parsed values
- **Required field validation**: Ensures streaming constraints are met

### TypeScript Implementation Analysis  

#### **Current Streaming Foundation** (Partial Implementation)
**Entry Point:** `/Users/kyle/Documents/Projects/jsonish/jsonish/src/parser.ts:431-531`

```typescript
function parsePartialObject<T extends z.ZodObject<any>>(input: string, schema: T, ctx: ParsingContext) {
  // STEP 1: Pre-check for incomplete arrays  
  // STEP 2: Extract whatever JSON we can
  // STEP 3: Fill missing fields with defaults
}
```

**Current Capabilities:**
- ✅ **Value completion state tracking**: All Value types include `completion: CompletionState`
- ✅ **Basic incomplete array detection** (lines 554-600 in parser.ts)
- ✅ **State machine partial recovery** in state-machine.ts
- ✅ **Auto-closing brackets/quotes** in fixing-parser.ts

#### **Advanced JSON Auto-Fixing** 
**Implementation:** `/Users/kyle/Documents/Projects/jsonish/jsonish/src/fixing-parser.ts`

- ✅ **Malformed value structures**: `"field": null{...}` → escaped strings (lines 492-539)
- ✅ **Double-escaped quotes**: `""text""` → `"text"` (lines 406-444)  
- ✅ **Array element normalization**: `[hello, world]` → `["hello", "world"]`
- ✅ **Comma-separated numbers**: `-2,000.00` → `-2000.00`

### Critical Implementation Gaps

#### **1. Streaming State Management** ❌ **CRITICAL**
**Tests Expecting State Objects:**
```typescript
// From test/streaming.test.ts:21-39
const StreamWithStateSchema = z.object({
  nums: z.object({
    value: z.array(z.number()),
    state: z.enum(["Incomplete", "Complete", "Pending"]),
  })
});
```

**Current Implementation Issue:**
- Parser returns raw values instead of state-wrapped objects
- No automatic state field generation
- Missing semantic streaming validation equivalent to Rust's `@stream.*` annotations

#### **2. Progressive Array Element Parsing** ❌ **CRITICAL** 
**Test Case:** `test/streaming.test.ts:13` - "should parse incomplete array during streaming"
```typescript
// Input: "{'nums': [1,2"   (missing closing brackets)
// Expected: { nums: [1] }  (only complete elements)
// Actual: { nums: [1, 2] } (includes incomplete element)
```

**Root Cause:** `/Users/kyle/Documents/Projects/jsonish/jsonish/src/parser.ts:79-121`
```typescript
if (opts.allowPartial && schema instanceof z.ZodObject) {
  const isIncomplete = hasIncompleteArrayElementsForField(input, key);
  if (isIncomplete) {
    incompleteArrayResult[key] = []; // Sets empty arrays - WRONG!
  }
}
```

The parser detects incomplete arrays but returns empty arrays instead of preserving complete elements.

#### **3. Markdown JSON Parsing for Partial Content** ❌ **HIGH PRIORITY**
**Failing Tests:** `test/partials.test.ts:223, 260, 298, 341, 383`

**Root Cause Analysis:**
- Parser returns `"Invalid input: expected object, received string"` for markdown-wrapped JSON
- Union resolution fails for partial markdown content
- Extractors not properly integrated with partial parsing options

#### **4. Union Resolution for Streaming Content** ❌ **HIGH PRIORITY**  
**Error Pattern:** 
```
No union option matched value: "```json\n{\"vertices\": [...truncated"
```

**Root Cause:** `/Users/kyle/Documents/Projects/jsonish/jsonish/src/parser.ts:2477`
- Union scoring doesn't handle partial/incomplete JSON structures
- Markdown extraction not integrated with union resolution for streaming

#### **5. Optional Field Preservation** ❌ **MEDIUM PRIORITY**
**Test Issue:** Large memory test - optional `metadata` arrays being stripped

### Test Failure Analysis

#### **Streaming Tests: 5/10 FAILING**

1. **Line 13**: `should parse incomplete array during streaming`
   - **Issue**: Returns `[1, 2]` instead of `[1]` for incomplete array
   - **Fix**: Implement progressive element parsing

2. **Line 20**: `should handle streaming with state tracking`  
   - **Issue**: ZodError "expected object, received string"
   - **Fix**: Implement automatic state wrapper generation

3. **Line 250**: Large memory test with complex unions
   - **Issue**: Optional `metadata` fields being stripped  
   - **Fix**: Preserve optional fields in union resolution

4. **Line 360**: `should handle streaming arrays with partial elements`
   - **Issue**: Includes incomplete objects in arrays
   - **Fix**: Stop at first incomplete element

5. **Line 377**: `should handle streaming nested arrays`
   - **Issue**: Includes incomplete subarrays  
   - **Fix**: Apply progressive parsing to nested structures

#### **Partial Tests: 6/11 FAILING**

1. **Line 223**: Complete book analysis - cannot parse markdown JSON
2. **Line 260**: Partial book analysis with `allowPartial: true` returns empty arrays  
3. **Line 298**: Partial graph JSON parsing returns empty arrays
4. **Line 341, 383**: Union type resolution fails for partial markdown content
5. **Line 450**: Incomplete string handling - returns `undefined` instead of empty array

## Parser Flow Analysis

### **Current TypeScript Flow:**
1. **Raw input** → `parseBasic()` → **6-strategy cascade**
2. **JSON extraction** → fixing-parser → **auto-fixed JSON**
3. **State machine** → Value construction → **completion tracking**
4. **Deserializer** → Zod coercion → **final result**

### **Missing Rust-Equivalent Flow:**
1. **Chunk processing** for true streaming
2. **Semantic validation** with stream annotations  
3. **Field-level completion** tracking in objects
4. **Progressive validation** during parsing
5. **Memory-efficient** streaming with bounded context

## Architecture Insights

### **TypeScript Strengths:**
- ✅ **Sophisticated 6-tier fallback** parsing strategies
- ✅ **Advanced JSON auto-fixing** with context-aware heuristics
- ✅ **Flexible Value representation** with completion states
- ✅ **Intelligent union scoring** with caching (0-100 scale)
- ✅ **Comprehensive test coverage** (236+ tests across features)

### **Rust Architecture Advantages:**
- ✅ **True incremental streaming** with chunk-based processing
- ✅ **Semantic streaming annotations** (`@stream.done`, `@stream.not_null`)
- ✅ **Field-level streaming state** management
- ✅ **Production-grade performance** optimizations
- ✅ **Memory-efficient streaming** architecture

### **Critical Missing Components:**

1. **Streaming Context Preservation** - Parser processes entire input at once
2. **State-Aware Object Generation** - No automatic state wrapper creation  
3. **Progressive Element Parsing** - Doesn't stop at incomplete elements
4. **Semantic Stream Validation** - No equivalent to Rust's `@stream.*` system
5. **Chunk-Based Processing** - Cannot handle true real-time streaming

## Code References
- `jsonish/src/parser.ts:431-531` - Partial object parsing (incomplete implementation)
- `jsonish/src/parser.ts:554-628` - Incomplete array detection (returns wrong results)
- `jsonish/src/parser.ts:2472-2477` - Union resolution error (fails on partial markdown)
- `jsonish/src/state-machine.ts:112-331` - State machine with auto-closing (partial support)
- `jsonish/src/fixing-parser.ts:492-539` - Malformed value structure fixing
- `jsonish/src/coercer.ts:434-453` - Incomplete string validation (basic support)
- `test/streaming.test.ts:13-39` - Key failing streaming tests
- `test/partials.test.ts:223-383` - Core Rust compatibility test failures

## Implementation Recommendations

### **Phase 1: Critical Fixes (High Impact)**
1. **Fix progressive array parsing** - Stop at incomplete elements instead of including them
2. **Implement state wrapper generation** - Auto-generate state objects for streaming schemas
3. **Fix markdown JSON parsing** - Integrate extractors with partial parsing options
4. **Enhance union resolution** - Handle partial/incomplete JSON in union scoring

### **Phase 2: Streaming Enhancement (Medium Impact)**  
5. **Add semantic streaming validation** - TypeScript equivalent of Rust's `@stream.*`
6. **Implement field-level completion** - Track completion state per object field
7. **Optimize union resolution** - Streaming-aware scoring and caching

### **Phase 3: Production Streaming (Future)**
8. **Chunk-based processing** - True incremental streaming support
9. **Memory optimization** - Bounded memory usage for long streams
10. **Performance optimization** - Match Rust implementation performance

The TypeScript implementation provides an excellent foundation with sophisticated parsing strategies and error recovery, but requires architectural enhancements for production streaming scenarios that match the Rust implementation's streaming capabilities.

## Related Documentation  
- `CLAUDE.md` - JSONish parser development guidelines and architecture overview
- `README.md` - Parser feature documentation and usage examples  
- `specifications/11-streaming-parsing/feature.md` - Streaming parsing requirements
- `specifications/12-partial-object-parsing/feature.md` - Partial parsing specification

## Open Questions
1. Should the TypeScript implementation add chunk-based processing for true real-time streaming?
2. How should the semantic streaming annotations be expressed in TypeScript/Zod schemas?
3. What performance benchmarks should guide the streaming optimization efforts?
4. Should the streaming state management be automatic or require explicit schema configuration?