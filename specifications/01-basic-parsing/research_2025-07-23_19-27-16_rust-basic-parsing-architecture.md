---
date: 2025-07-23 19:27:16 CDT
researcher: Claude Code
git_commit: 4e974c5db60f8c7dd723a17d38948bae5afc488f
branch: master
repository: jsonish
topic: "Rust Basic Parsing Architecture Analysis"
tags: [research, codebase, parser, deserializer, coercer, value-system, error-recovery, type-coercion]
status: complete
last_updated: 2025-07-23
last_updated_by: Claude Code
type: research
---

# Research: Rust Basic Parsing Architecture Analysis

**Date**: 2025-07-23 19:27:16 CDT
**Researcher**: Claude Code
**Git Commit**: 4e974c5db60f8c7dd723a17d38948bae5afc488f
**Branch**: master
**Repository**: jsonish

## Research Question
Understanding the Rust implementation of basic JSON parsing in the JSONish library to guide TypeScript implementation - analyzing parser architecture, error recovery mechanisms, value system, type coercion, and test patterns without implementation details.

## Summary
The JSONish Rust parser employs a sophisticated cascade-based parsing architecture with four main components: a multi-strategy parser, an internal Value representation system, a comprehensive type coercion system, and extensive error recovery mechanisms. The system prioritizes successful parsing over strict JSON compliance, making it ideal for handling malformed LLM output.

## Detailed Findings

### Core Architecture Components

#### 1. **Multi-Strategy Parser System**
- **Entry Point**: `src/jsonish/parser/entry.rs` - Orchestrates cascading fallback parsing strategies
- **Error Recovery**: `src/jsonish/parser/fixing_parser.rs` - State machine for malformed JSON recovery
- **Content Extraction**: `src/jsonish/parser/markdown_parser.rs` and `multi_json_parser.rs` - Mixed content handling
- **Streaming Support**: `src/jsonish/iterative_parser.rs` - Partial/streaming JSON parsing

#### 2. **Value Representation System**  
- **Core Types**: `src/jsonish/value.rs` - Internal Value enum with completion state tracking
- **Data Structures**: `src/jsonish/parser/fixing_parser/json_collection.rs` - Intermediate parsing representations
- **State Machine**: `src/jsonish/parser/fixing_parser/json_parse_state.rs` - Context-aware character processing

#### 3. **Type Coercion System**
- **Central Dispatcher**: `src/deserializer/coercer/field_type.rs` - Routes coercion requests
- **Primitive Handling**: `src/deserializer/coercer/coerce_primitive.rs` - Basic type conversions
- **Complex Types**: Array, union, map, literal, class/object coercers
- **Scoring**: `src/deserializer/score.rs` - Quality-based type selection

#### 4. **Error Recovery & Validation**
- **Flag System**: `src/deserializer/deserialize_flags.rs` - Comprehensive transformation tracking
- **String Matching**: `src/deserializer/coercer/match_string.rs` - Fuzzy enum/literal matching
- **Streaming**: `src/deserializer/semantic_streaming.rs` - Partial data validation

## Parser Flow Architecture

### 1. **Cascading Parse Strategy (entry.rs)**
The main parser implements a sophisticated fallback system:
1. **Standard JSON parsing** via `serde_json` (performance optimization)
2. **Markdown extraction** if `allow_markdown_json` enabled
3. **Multi-JSON object detection** if `all_finding_all_json_objects` enabled  
4. **Error recovery parsing** if `allow_fixes` enabled
5. **Fallback to string** if `allow_as_string` enabled

**Key Features**:
- Depth protection (100-level limit) prevents infinite recursion
- Completion state handling for partial vs complete parsing
- Value wrapping in `AnyOf` containers for multiple interpretations

### 2. **Error Recovery State Machine (fixing_parser.rs)**
Implements character-by-character parsing with sophisticated error recovery:

**Error Recovery Capabilities**:
- Unquoted single word strings
- Single quoted strings (`'string'`)
- Badly escaped characters
- Numbers starting with `.`
- Comments (`//` and `/* */`)
- Trailing and leading commas
- Unterminated arrays, objects, and strings
- Mixed quote types

**Parser Strategy**:
- Character-by-character processing with lookahead context
- Collection stack for nested structures
- Completion tracking for partial vs complete parsing
- Multiple result handling for ambiguous cases

### 3. **Value System Bridge (value.rs)**
The `Value` enum serves as the critical bridge between parsing and deserialization:

**Value Variants**:
- `String(String, CompletionState)` - Strings with completion tracking
- `Number(serde_json::Number, CompletionState)` - Numeric values  
- `Boolean(bool)`, `Null` - Primitives (always complete)
- `Object(Vec<(String, Value)>, CompletionState)` - Key-value pairs
- `Array(Vec<Value>, CompletionState)` - Arrays with completion state
- `Markdown(String, Box<Value>, CompletionState)` - Extracted values
- `FixedJson(Box<Value>, Vec<Fixes>)` - Error-recovered values
- `AnyOf(Vec<Value>, String)` - Multiple interpretations

**Key Design Patterns**:
- Completion state tracking enables streaming/partial JSON
- `FixedJson` preserves both fixed value and applied fixes
- `AnyOf` allows multiple interpretations until context determines best match
- Flexible representation maintains structure while handling malformed JSON

## Type Coercion Architecture

### 1. **Coercion Pipeline**
1. **Raw Input** → **JsonCollection** → **Value** → **BamlValueWithFlags**  
2. Values carry completion state throughout pipeline
3. Error fixes tracked in `FixedJson` variants
4. Multiple interpretations preserved in `AnyOf` variants

### 2. **Scoring System for Union Resolution**
**Algorithm** (lower scores are better):
- `DefaultFromNoValue`: 100 (heavy penalty)
- `StringToBool`, `StringToFloat`: 1 (light penalty)
- `UnionMatch`, `InferedObject`: 0 (no penalty)
- Array parsing errors scale with index position

**Union Type Resolution**: Scoring system selects best coercion when multiple succeed.

### 3. **Primitive Type Coercion Strategies**
- **String**: Direct pass-through; other types converted via `JsonToString` flag
- **Integer**: Supports fractions (`"3/4"` → `0.75`), comma-separated (`"1,234"` → `1234`)
- **Float**: Includes currency symbol handling (`"$1,234.56"` → `1234.56`)
- **Boolean**: Exact matches and fuzzy string matching for "true"/"false" variants
- **Array-to-Singular**: Extract single values from arrays when needed

### 4. **Complex Type Handling**
- **Arrays**: Element-wise coercion with error tracking per index
- **Objects/Classes**: Field mapping, implied fields, default values, constraint validation
- **Unions**: Attempt all variants, select best scoring result
- **Enums**: Fuzzy string matching with punctuation normalization
- **Maps**: Key validation, recursive value coercion

## Code References

### Parser System
- `src/jsonish/parser/entry.rs:parse_func()` - Main parsing orchestration with cascade strategy
- `src/jsonish/parser/fixing_parser.rs:parse()` - Error recovery state machine entry point
- `src/jsonish/parser/fixing_parser/json_parse_state.rs` - Character-by-character processing logic
- `src/jsonish/parser/fixing_parser/json_collection.rs` - Intermediate parsing data structures
- `src/jsonish/parser/markdown_parser.rs:parse()` - Code block extraction with regex patterns
- `src/jsonish/parser/multi_json_parser.rs` - Multiple JSON object detection via bracket counting

### Value System  
- `src/jsonish/value.rs` - Core Value enum with completion state and type methods
- `src/jsonish/value.rs:simplify()` - AnyOf variant resolution based on completion state
- `src/jsonish/value.rs:complete_deeply()` - Recursive completion state marking

### Type Coercion System
- `src/deserializer/coercer/field_type.rs:coerce()` - Central coercion dispatcher
- `src/deserializer/coercer/coerce_primitive.rs` - String, number, boolean coercion logic
- `src/deserializer/coercer/coerce_union.rs` - Union type resolution with scoring
- `src/deserializer/coercer/coerce_array.rs` - Array handling and single-to-array conversion
- `src/deserializer/coercer/ir_ref/coerce_class.rs` - Complex object coercion with field mapping
- `src/deserializer/coercer/array_helper.rs:pick_best()` - Sophisticated result selection algorithm

### Scoring and Validation
- `src/deserializer/score.rs` - Penalty-based scoring system for type selection
- `src/deserializer/deserialize_flags.rs` - Comprehensive transformation flag definitions
- `src/deserializer/coercer/match_string.rs` - Multi-stage fuzzy string matching
- `src/deserializer/semantic_streaming.rs` - Streaming state validation logic

### Test Patterns
- `src/tests/test_basics.rs` - Core primitive and mixed content parsing tests
- `src/tests/test_class.rs` - Object parsing and malformed JSON recovery tests
- `src/tests/test_unions.rs` - Union type resolution and scoring behavior tests
- `src/tests/macros.rs` - Test infrastructure with partial/streaming support

## Parser Flow Summary

1. **Entry Point** (`entry.rs`) orchestrates parsing attempts with cascade fallbacks
2. **Standard JSON** tried first for performance on valid JSON
3. **Markdown Extraction** (`markdown_parser.rs`) pulls JSON from code blocks  
4. **Multi-Object Detection** (`multi_json_parser.rs`) finds multiple JSON objects
5. **Error Recovery** (`fixing_parser.rs`) attempts malformed JSON fixes
6. **Value Construction** (`json_collection.rs` → `value.rs`) creates internal representation
7. **Type Coercion** (`deserializer/coercer/*`) converts to target schema
8. **Scoring & Selection** (`score.rs`, `array_helper.rs`) picks best result for unions
9. **Flag Attachment** (`deserialize_flags.rs`) tracks all transformations
10. **Final Validation** (`semantic_streaming.rs`) checks completion requirements

## Architecture Insights

### Key Design Principles
- **Cascading Fallbacks**: Multiple parsing strategies with graceful degradation
- **Context Awareness**: Parsing behavior changes based on position and surroundings  
- **Completion Tracking**: Distinguishes between partial and complete parsing states
- **Error Recovery**: Attempts to fix common JSON formatting issues automatically
- **Multiple Interpretations**: Preserves alternative parsing results when ambiguous
- **Quality Scoring**: Quantitative approach to selecting best type coercion
- **Transformation Transparency**: Complete tracking of all applied fixes and conversions

### Error Recovery Strategies
1. **Incremental Fixes**: Add missing commas, close brackets, handle quotes
2. **Graceful Degradation**: Attempt multiple parsing strategies before failing
3. **Context Preservation**: Maintain structural integrity despite parsing errors
4. **Validation Integration**: Final validation against target schema with clear errors

### Type System Integration
- **Schema-First Approach**: Target schema drives parsing and coercion decisions
- **Zod-Compatible**: Designed to work with Zod validation in TypeScript port
- **Union Resolution**: Sophisticated scoring for ambiguous type scenarios
- **Streaming Support**: Handles partial data with completion state tracking

## Expected TypeScript Implementation Patterns

### Core Components Needed
1. **Parser Entry Point**: Implement cascade strategy with fallback options
2. **Error Recovery**: State machine for character-by-character malformed JSON handling  
3. **Value System**: Internal representation with completion state tracking
4. **Type Coercers**: Modular coercion system for each target type
5. **Scoring System**: Quality-based selection for union types
6. **Flag System**: Comprehensive transformation tracking

### Key Implementation Guidelines
- Maintain exact parity with Rust behavior for all test cases
- Implement schema-aware parsing that respects Zod validation rules
- Build robust error recovery that never throws uncaught exceptions
- Ensure performance comparable to standard JSON.parse for valid inputs
- Provide intelligent content extraction from mixed text/markdown inputs
- Handle all documented edge cases and malformed JSON scenarios gracefully

## Related Documentation
- `CLAUDE.md` - JSONish architecture and development guidelines
- `specifications/requirements.md` - Original parser requirements and specifications  
- `test/basics.test.ts` - TypeScript test expectations (currently 62/67 passing)

## Open Questions
1. **Performance Optimization**: How to balance error recovery thoroughness with parsing speed
2. **Memory Management**: Efficient handling of multiple interpretation tracking in `AnyOf` values
3. **Streaming Integration**: Real-time parsing coordination with completion state management
4. **Extension Points**: Plugin architecture for custom coercion rules and error recovery strategies