---
date: 2025-08-25T23:04:58+0000
researcher: Claude Code
git_commit: 93fbb474173111a0ebab89f680a87108ba788fe9
branch: master
repository: jsonish
topic: "BAML Parser Implementation Strategy for Basic Parsing Feature"
tags: [research, codebase, parser, deserializer, type-coercion, error-recovery, value-system, baml, jsonish]
status: complete
last_updated: 2025-08-25
last_updated_by: Claude Code
type: research
---

# Research: BAML Parser Implementation Strategy for Basic Parsing Feature

**Date**: 2025-08-25T23:04:58+0000  
**Researcher**: Claude Code  
**Git Commit**: 93fbb474173111a0ebab89f680a87108ba788fe9  
**Branch**: master  
**Repository**: jsonish  

## Research Question

Research the necessary parts of the BAML parser to implement `specifications/01-basic-parsing/feature.md` - a comprehensive basic JSON parsing feature that handles primitive types, arrays, objects, mixed content scenarios, error recovery, type coercion, and schema-aware parsing using Zod validation.

## Summary

The research reveals that the current TypeScript implementation is completely missing (0/412 tests passing) while the Rust reference implementation provides a comprehensive architecture for implementing all required features. The TypeScript codebase needs to be rebuilt from scratch following the Rust architecture: **Entry Parser → Multi-Strategy Parsing → Value System → Deserializer → Type Coercion → Schema Validation**.

**Critical Gap**: All source files deleted except minimal stub. Must implement complete parser infrastructure:
- Multi-strategy parsing with cascading fallbacks
- Error recovery state machine for malformed JSON  
- Value representation system matching Rust enum
- Schema-aware type coercion with scoring system
- Comprehensive edge case handling (412 test scenarios)

## Detailed Findings

### **Parser Architecture and Entry Point**

**Reference Implementation**: `/Users/kyle/Documents/Projects/jsonish/baml/engine/baml-lib/jsonish/src/jsonish/parser/entry.rs:15-242`

**Multi-Strategy Cascading Approach**:
```rust
pub fn parse(str: &str, options: ParseOptions, is_done: bool) -> Result<Value>
```

**Five-Phase Strategy Execution** (in order):

1. **Standard JSON Parsing** (`entry.rs:25-55`)
   - First attempts `serde_json::from_str()` for valid JSON
   - Sets completion states: strings in quotes → Complete, numbers → Incomplete
   - Returns `Value::AnyOf` wrapper with original string

2. **Markdown Code Block Extraction** (`entry.rs:57-141`)
   - Enabled when `options.allow_markdown_json = true`
   - Uses regex `r"```([a-zA-Z0-9 ]+)(?:\n|$)"` for code block detection
   - Creates `Value::Markdown` with language tags preserved
   - Handles multiple blocks as array + individual items

3. **Multi-Object JSON Detection** (`entry.rs:143-178`)
   - Enabled when `options.all_finding_all_json_objects = true`
   - Uses bracket balancing to find multiple JSON objects
   - Creates `Value::FixedJson` with `Fixes::GreppedForJSON`
   - Returns both individual objects and aggregated array

4. **Fixing Parser Fallback** (`entry.rs:180-228`)
   - Activated when `options.allow_fixes = true`
   - State machine approach for malformed JSON recovery
   - Returns `Value::FixedJson` with applied fixes metadata

5. **String Fallback** (`entry.rs:230-239`)
   - Final strategy when `options.allow_as_string = true`
   - Returns raw string with completion state

**Key Integration Pattern**: All strategies return `Value::AnyOf(candidates, original_string)` for consistent downstream processing.

### **Error Recovery and Fixing Parser System**

**Reference Implementation**: `/Users/kyle/Documents/Projects/jsonish/baml/engine/baml-lib/jsonish/src/jsonish/parser/fixing_parser/`

**State Machine Architecture**:
- **Core State**: `JsonParseState` with collection stack for nested structures
- **Character-by-Character Processing**: Iterates with lookahead capabilities  
- **Context Tracking**: Enum `Pos` tracks context (InNothing, InObjectKey, InObjectValue, InArray)

**Error Recovery Strategies**:

1. **Trailing Comma Handling** (`json_parse_state.rs:194-293`)
   - Detects trailing commas in objects/arrays with smart lookahead
   - Differentiates intentional commas from LLM errors

2. **Incomplete Structure Handling** (`fixing_parser.rs:47-50`)
   - Auto-closes missing brackets/braces: `while !state.collection_stack.is_empty()`
   - Missing quotes with context-aware termination logic

3. **Unquoted Key/Value Handling** (`json_collection.rs:103-123`)
   - Supports `key: "value"` format and `value with space` patterns
   - Type inference: `"true"` → boolean, `"123"` → number, etc.

4. **Advanced Quote Handling**
   - Single quotes, triple quotes, backticks, Python-style `"""strings"""`
   - Complex escape handling and mixed quote scenarios

**Edge Cases Covered**:
- Triple-quoted strings: `"""multiline content"""` → `"multiline content"`
- Complex malformed sequences with deeply nested errors
- Comments support (`//` and `/* */` styles)
- Whitespace tolerance with flexible formatting

### **Value Representation System**

**Reference Implementation**: `/Users/kyle/Documents/Projects/jsonish/baml/engine/baml-lib/jsonish/src/jsonish/value.rs:14-34`

**Core Value Enum** (TypeScript equivalent needed):
```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Value {
    // Primitives with completion tracking
    String(String, CompletionState),
    Number(serde_json::Number, CompletionState), 
    Boolean(bool),
    Null,
    
    // Complex types with structural completion
    Object(Vec<(String, Value)>, CompletionState),
    Array(Vec<Value>, CompletionState),
    
    // Special parsing result types
    Markdown(String, Box<Value>, CompletionState),  // Code block extraction
    FixedJson(Box<Value>, Vec<Fixes>),              // Error recovery tracking  
    AnyOf(Vec<Value>, String),                      // Multiple interpretations
}
```

**Key Design Features**:
- **CompletionState Tracking**: Every value tracks `Complete` vs `Incomplete` for streaming
- **Fix Attribution**: `FixedJson` records applied transformations for debugging
- **Ambiguity Handling**: `AnyOf` represents multiple valid interpretations
- **Universal Intermediate**: Bridge between raw text and typed schemas

**Value Operations** (`value.rs:71-193`):
- `completion_state()`: Aggregate completion state from nested values
- `complete_deeply()`: Recursively mark all nested values as complete
- `simplify()`: Reduce `AnyOf` to single value when appropriate

### **Type Coercion and Deserializer System**

**Reference Implementation**: `/Users/kyle/Documents/Projects/jsonish/baml/engine/baml-lib/jsonish/src/deserializer/coercer/`

**Coercer Architecture**:
- **TypeCoercer Trait**: Two methods - `try_cast()` (strict) and `coerce()` (flexible)
- **Primitive Coercers**: String, number, boolean, null with cross-type conversion
- **Collection Coercers**: Array (with single-to-array wrapping), object/map
- **Advanced Coercers**: Union (with scoring), literal, enum (case-insensitive), class

**Type Conversion Logic**:

1. **Number Coercion** (`coerce_primitive.rs:156-217`)
   - Comma-separated: `"1,234.56"` → `1234.56`
   - Currency: `"$1,234.56"` → `1234.56` 
   - Fractions: `"1/5"` → `0.2`
   - Float-to-int with rounding: `3.7` → `4`

2. **Boolean Coercion** (`coerce_primitive.rs:314-374`)
   - Case-insensitive: `"True"`, `"TRUE"` → `true`
   - Text extraction: `"The answer is true"` → `true`
   - Markdown: `"**True**"` → `true`
   - Ambiguity detection: `"true or false"` → Error

3. **String Schema Priority**: In unions, ambiguous content like `"1 cup butter"` returns as string rather than extracting number `1`

4. **Array Wrapping**: Single values automatically wrapped when targeting array schema

**Schema Integration Patterns**:
- **Schema-First Approach**: Target schema drives coercion decisions
- **Zod Integration**: Native support for all Zod schema types
- **Validation Pipeline**: Integrated validation with clear error messages

### **Scoring System and Union Resolution**

**Reference Implementation**: `/Users/kyle/Documents/Projects/jsonish/baml/engine/baml-lib/jsonish/src/deserializer/score.rs:34-77`

**Scoring Algorithm** (lower scores = better matches):
- **Perfect Matches (Score: 0)**: Union selection, constraint checking
- **Minimal Penalties (Score: 1)**: Type conversions, optional defaults, single-to-array  
- **Higher Penalties (Score: 2+)**: Lossy conversions, fuzzy matching
- **Severe Penalties (Score: 100+)**: Using defaults when values present

**Union Resolution Strategy** (`coerce_union.rs:69-94`):
1. **Phase 1**: Fast path with `try_cast` for exact matches
2. **Phase 2**: Flexible path with `coerce` and scoring-based selection
3. **Best Match Selection**: Structural preferences, content quality, score comparison

**Complex Selection Logic** (`array_helper.rs:26-287`):
- Prefers proper arrays over single→array conversions
- Avoids markdown-sourced strings when possible  
- Penalizes classes with all default values
- Composite types preferred over primitive conversions

### **Current Implementation Status and Gaps**

**Critical Missing Components**:
- **Entry Parser**: `src/jsonish/parser/entry.ts` - MISSING
- **Fixing Parser**: `src/jsonish/parser/fixing-parser/` - MISSING  
- **Value System**: `src/jsonish/value.ts` - DELETED
- **Deserializer**: `src/deserializer/` - MISSING
- **Type Coercers**: `src/deserializer/coercer/` - MISSING

**Current State**: Only `/Users/kyle/Documents/Projects/jsonish/jsonish/src/index.ts` exists:
```typescript
export function parse<T extends z.ZodAny>(llmGeneratedResponse: string, schema: T): z.infer<T> {
    return schema.parse({})  // Stub returning empty object
}
```

**Test Impact**: 0/412 tests passing due to missing `createParser` function and complete implementation absence.

## Code References

### **Parser Architecture**
- `baml/engine/baml-lib/jsonish/src/jsonish/parser/entry.rs:15-242` - Multi-strategy parsing coordination
- `baml/engine/baml-lib/jsonish/src/jsonish/parser/fixing_parser/fixing_parser.rs:11-98` - Error recovery state machine
- `baml/engine/baml-lib/jsonish/src/jsonish/parser/markdown_parser.rs` - Code block extraction logic
- `baml/engine/baml-lib/jsonish/src/jsonish/parser/multi_json_parser.rs` - Multi-object detection

### **Value and Type Systems**
- `baml/engine/baml-lib/jsonish/src/jsonish/value.rs:14-34` - Complete Value enum definition
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/field_type.rs:22-218` - TypeCoercer trait and interface
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_primitive.rs:156-374` - Primitive type coercion logic
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_union.rs:69-94` - Union resolution strategy

### **Scoring and Configuration**
- `baml/engine/baml-lib/jsonish/src/deserializer/score.rs:20-77` - Scoring algorithm implementation
- `baml/engine/baml-lib/jsonish/src/deserializer/deserialize_flags.rs:6-56` - Configuration flag system
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/array_helper.rs:26-287` - Best match selection logic

### **Test Coverage** 
- `test/basics.test.ts:1-1115` - Core parsing tests (67 tests covering all primitive types and edge cases)
- `test/streaming.test.ts` - Partial/incomplete JSON handling tests
- `test/partials.test.ts` - Malformed JSON recovery tests  
- `test/unions.test.ts` - Union type resolution and scoring tests

## Parser Flow Architecture

**Complete Data Flow**: Raw LLM Output → Entry Parser → Strategy Selection → Value Creation → Deserializer → Type Coercion → Schema Validation → Typed Result

**Detailed Flow**:
1. **Input Processing**: Raw string + ParseOptions + completion flag
2. **Strategy Selection**: Cascading through 5 strategies based on options/content
3. **Value Creation**: Each strategy returns `Value` enum variants in `AnyOf` wrapper
4. **Completion Tracking**: All values tagged with completion state for streaming
5. **Deserialization**: Values matched against Zod schemas with coercion
6. **Type Coercion**: Cross-type conversions with scoring-based selection
7. **Validation**: Final validation against schema with detailed error reporting

**Key Architecture Benefits**:
- **Fault Tolerance**: Multiple fallback strategies ensure parsing always succeeds
- **Streaming Support**: Completion state enables partial result handling  
- **Debugging Support**: Fix metadata and multiple candidates aid troubleshooting
- **Extensibility**: Strategy pattern allows adding new parsing approaches
- **Type Safety**: Full integration with TypeScript and Zod validation

## Architecture Insights

### **Multi-Strategy Resilience**
The BAML parser implements a **progressive degradation model** where each parsing strategy provides increasingly permissive interpretation of input content. This ensures that even heavily malformed LLM output can be processed while maintaining high-quality results for well-formed input.

### **Completion State Streaming**
The **dual-state completion tracking** (`Complete`/`Incomplete`) enables real-time processing of streaming LLM output, allowing applications to display partial results while generation is ongoing and final results when complete.

### **Transparent Error Recovery**  
The **fix attribution system** (`FixedJson` + `Vec<Fixes>`) provides complete transparency about what transformations were applied during parsing, enabling confidence scoring and user decision-making about result quality.

### **Schema-Driven Intelligence**
The **schema-first approach** uses Zod schemas to guide parsing decisions, enabling intelligent behavior like string priority in unions and automatic type coercion based on expected output structure rather than just input format.

### **Union Resolution with Scoring**
The **quantitative scoring system** provides deterministic resolution of ambiguous type scenarios, particularly important for union types where multiple interpretations are valid but some are clearly better than others.

## Related Documentation

- `specifications/requirements.md` - Overall JSONish parser requirements and architecture
- `specifications/01-basic-parsing/feature.md` - Specific basic parsing feature requirements  
- `test/basics.test.ts` - Comprehensive test coverage showing expected behavior
- `CLAUDE.md` - Development guidelines and architectural decisions (if exists)

## Related Research

- `specifications/01-basic-parsing/implementation-plan.md` - Implementation planning for basic parsing (DELETED)
- `specifications/01-basic-parsing/research_2025-07-23_19-27-16_rust-basic-parsing-architecture.md` - Previous research on Rust architecture (DELETED)

## Open Questions

1. **TypeScript Value Enum Design**: How to best represent Rust's discriminated union in TypeScript while maintaining type safety and performance?

2. **Streaming Integration**: How to integrate completion state tracking with Node.js streaming APIs for real-time LLM output processing?

3. **Error Recovery State Machine**: What's the optimal balance between parsing flexibility and performance for the character-by-character state machine approach?

4. **Zod Schema Analysis**: How to efficiently analyze complex Zod schemas (with unions, transforms, refinements) to guide parsing decisions?

5. **Test Infrastructure**: Should the TypeScript implementation maintain the same 412-test structure, or consolidate/reorganize for different testing patterns?

6. **Bundle Size Optimization**: How to balance comprehensive parsing capabilities with client-side bundle size requirements?

## Implementation Priority

Based on the research findings, the recommended implementation order:

1. **Value System**: Core data representation matching Rust enum
2. **Entry Parser**: Multi-strategy coordination and fallback logic  
3. **Fixing Parser**: State machine for error recovery (most complex component)
4. **Basic Coercers**: Primitive type coercion for immediate test progress
5. **Deserializer Integration**: Zod schema matching and validation
6. **Advanced Features**: Union resolution, markdown extraction, multi-object parsing

This research provides the comprehensive foundation needed to implement a production-ready TypeScript JSONish parser that handles all real-world LLM output scenarios while maintaining the robust architecture and comprehensive test coverage of the original Rust implementation.