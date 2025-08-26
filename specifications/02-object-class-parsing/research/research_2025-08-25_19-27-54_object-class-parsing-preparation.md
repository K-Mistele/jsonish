---
date: 2025-08-25T19:27:54-05:00
researcher: Claude Code
git_commit: 93fbb474173111a0ebab89f680a87108ba788fe9
branch: master
repository: jsonish
topic: "Understanding how to prepare for 02-object-class-parsing"
tags: [research, codebase, object-parsing, class-parsing, parser-architecture, type-coercion, error-recovery, zod-integration]
status: complete
last_updated: 2025-08-25
last_updated_by: Claude Code
type: research
---

# Research: Understanding how to prepare for 02-object-class-parsing

**Date**: 2025-08-25T19:27:54-05:00  
**Researcher**: Claude Code  
**Git Commit**: 93fbb474173111a0ebab89f680a87108ba788fe9  
**Branch**: master  
**Repository**: jsonish

## Research Question

How should we prepare for implementing the 02-object-class-parsing feature? What is the current state of the codebase, what components are already implemented, and what gaps need to be filled to support comprehensive object and class parsing capabilities?

## Summary

The JSONish parser codebase is **well-positioned** for implementing 02-object-class-parsing with approximately **75% of core infrastructure already functional**. The multi-strategy parsing architecture, Value system, and basic type coercion are implemented and working. Current status: **58/67 basic parsing tests passing**, with remaining failures primarily in complex object edge cases. 

**Key findings**: The architecture follows the BAML Rust reference implementation patterns effectively, with robust error recovery and content extraction capabilities. The main gaps are in advanced union type resolution, field alias mapping, recursive object handling, and some error recovery edge cases for malformed nested objects.

## Detailed Findings

### Current Implementation Status (✅ Functional Components)

#### 1. Core Parser Architecture
- **Multi-Strategy Parsing**: `jsonish/src/parser.ts:7-83` - Six-strategy parsing approach implemented
  - Strategy 1: Standard JSON parsing
  - Strategy 2: Mixed content/markdown extraction  
  - Strategy 3: JSON fixing for malformed input
  - Strategy 4: Advanced state machine parsing
  - Strategy 5: Text extraction based on schema
  - Strategy 6: String fallback with coercion
- **Value System**: `jsonish/src/value.ts:1-85` - Complete discriminated union Value types with completion state tracking
- **API Interface**: `jsonish/src/index.ts:14-28` - Parser factory and unified export structure

#### 2. Object Parsing Core
- **Basic Object Coercion**: `jsonish/src/parser.ts:104-143` - Object field processing with schema-aware coercion
- **Field Mapping**: Exact field matching and whitespace-trimmed key handling
- **Nested Object Support**: Recursive object parsing through `coerceValue()` calls
- **Optional Field Handling**: Default undefined assignment for optional fields

#### 3. Type Coercion System  
- **Primitive Coercion**: `jsonish/src/coercer.ts:4-145` - String, number, boolean coercion with intelligent parsing
- **Advanced Number Parsing**: Currency symbols, fractions, comma-separated values
- **Text Extraction**: Context-aware boolean and number extraction from natural language
- **Array Coercion**: Single value to array wrapping and element-wise coercion

#### 4. Content Extraction
- **JSON Extraction**: `jsonish/src/extractors.ts:3-176` - Extract JSON from markdown, text, and mixed content
- **Markdown Code Blocks**: Full support for ```json code block parsing  
- **Multiple Object Detection**: Parse and validate multiple JSON objects from text
- **Pattern Recognition**: Regex-based JSON structure detection in unstructured text

#### 5. Error Recovery System
- **JSON Fixing**: `jsonish/src/fixing-parser.ts:1-81` - Comprehensive malformed JSON repair
  - Triple-quoted string handling
  - Unquoted key/value fixing
  - Trailing comma removal
  - Auto-bracket closure
- **State Machine Parsing**: Character-by-character parsing for complex malformed JSON

### Test Coverage Analysis

#### ✅ Working Object Scenarios (58/67 tests passing)
- **Basic object parsing**: Simple objects with mixed field types
- **Nested objects**: Multi-level object hierarchies with arrays
- **Markdown extraction**: Objects from ```json code blocks
- **Mixed content**: Object extraction from natural language text
- **Type coercion**: Primitive types within object fields
- **Field handling**: Optional field omission and nullable field support

#### ❌ Failing Object Scenarios (9 remaining test failures)
- **Complex malformed objects**: `test/basics.test.ts:948-1113` - Deeply nested malformed JSON recovery
- **Advanced whitespace handling**: Object keys with complex whitespace patterns  
- **Triple-quoted strings in objects**: Nested string handling edge cases
- **Unquoted key/value edge cases**: Complex unquoted object property parsing
- **Streaming object completion**: Partial object construction during streaming

### BAML Rust Reference Architecture Alignment

The TypeScript implementation closely follows the Rust patterns:

#### Object Parsing Flow Alignment
1. **Raw Input → Multi-Strategy Parser**: ✅ Implemented
2. **Parser → Value System**: ✅ Complete discriminated union Value types
3. **Value → Coercer System**: ✅ Schema-aware type coercion  
4. **Coercer → Result**: ✅ Zod schema validation integration

#### Advanced Pattern Implementation
- **Completion State Tracking**: ✅ `CompletionState` enum and propagation
- **Error Recovery Metadata**: ✅ `Fixes` tracking in `FixedJson` values
- **Multi-Candidate Parsing**: ✅ `AnyOf` values with candidate selection
- **Field Name Fuzzy Matching**: ⚠️ Basic implementation, needs enhancement

### Zod Schema Integration Patterns

#### Currently Supported
- **Basic Object Schemas**: `z.object()` with nested field definitions
- **Optional Fields**: `z.string().optional()` with proper undefined handling
- **Nullable Fields**: `z.string().nullable()` with null value support
- **Array Fields**: `z.array(z.object(...))` with nested object parsing
- **Nested Objects**: Multi-level schema validation and coercion

#### Integration Gaps Identified
- **Union Object Resolution**: `z.union()` with object alternatives needs scoring system
- **Discriminated Unions**: `z.discriminatedUnion()` requires discriminator field detection
- **Recursive Schemas**: `z.lazy()` needs circular reference protection
- **Field Alias Support**: Schema-level field name mapping not implemented

## Code References

### Core Parser Implementation
- `jsonish/src/parser.ts:7-83` - Multi-strategy parsing engine with object support
- `jsonish/src/parser.ts:104-143` - Object field coercion and schema matching
- `jsonish/src/value.ts:27-34` - Object Value type definition with completion state
- `jsonish/src/coercer.ts:4-145` - Type coercion system for object fields

### Object Processing Logic  
- `jsonish/src/extractors.ts:17-41` - Multiple object detection and extraction
- `jsonish/src/extractors.ts:62-176` - JSON pattern recognition in mixed content
- `jsonish/src/fixing-parser.ts:9-32` - Object-specific JSON repair (unquoted keys, brackets)

### Test Coverage
- `test/class.test.ts:1-1137` - 68 comprehensive object parsing test scenarios
- `test/basics.test.ts:349-916` - Basic object parsing integration tests
- `test/partials.test.ts:78-387` - Partial object parsing and streaming support
- `test/streaming.test.ts:44-253` - Complex object scenarios with union types

### BAML Rust Reference
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_class.rs:139-497` - Class coercion patterns
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/match_string.rs:38-133` - Field name matching algorithm
- `baml/engine/baml-lib/jsonish/src/jsonish/value.rs:27` - Object value representation

## Parser Flow

The object parsing follows this comprehensive flow:

1. **Input Processing**: Raw JSON or mixed content → Multi-strategy parsing
2. **Content Extraction**: Markdown code blocks, text patterns → JSON candidates  
3. **JSON Repair**: Malformed JSON → Fixed JSON via state machine parsing
4. **Value Construction**: Parsed JSON → Internal Value representation with completion state
5. **Schema Matching**: Value + Zod Schema → Field-by-field validation and coercion
6. **Object Construction**: Coerced fields → Final typed object result

## Architecture Insights

### Strengths of Current Implementation
- **Robust Error Recovery**: Multi-layered approach handles various malformed JSON scenarios
- **Content-Aware Parsing**: Intelligent extraction from markdown and mixed text content
- **Schema-First Design**: Zod schema drives all parsing and coercion decisions
- **Completion State Tracking**: Supports streaming and partial parsing scenarios
- **Type-Safe Architecture**: Full TypeScript integration with Zod schema types

### Areas for Enhancement
- **Union Type Resolution**: Needs scoring system for object type disambiguation  
- **Field Alias System**: Flexible field name mapping for real-world JSON variations
- **Recursive Object Handling**: Circular reference detection and lazy schema evaluation
- **Advanced Error Messages**: More precise validation error reporting for object schemas
- **Performance Optimization**: Large nested object processing efficiency

### Error Recovery Strategies
- **Graceful Degradation**: Parse valid portions of malformed objects
- **Context-Aware Fixing**: Object-specific JSON repair based on parsing context
- **State Preservation**: Maintain partial object state during streaming
- **Fix Tracking**: Record applied corrections for debugging and validation

## Related Documentation

- `specifications/02-object-class-parsing/feature.md` - Complete feature specification with 68 test scenarios
- `specifications/01-basic-parsing/implementation-plan.md` - Foundation parser implementation strategy
- `specifications/01-basic-parsing/research/research_2025-08-25_23-04-58_baml-parser-implementation-strategy.md` - BAML architecture analysis
- `test/class.test.ts` - Comprehensive object parsing test suite defining expected behaviors

## Implementation Readiness Assessment

### Ready for Implementation ✅
- **Basic Object Parsing**: Core infrastructure complete and functional
- **Content Extraction**: Markdown and text extraction working
- **Field Processing**: Schema-aware field coercion implemented
- **Error Recovery**: JSON fixing and state machine parsing functional

### Requires Development Work ⚠️  
- **Union Object Resolution**: Scoring system for object type selection
- **Field Alias Mapping**: Flexible key name matching and normalization
- **Recursive Schema Support**: Circular reference protection and lazy evaluation
- **Edge Case Handling**: Fix remaining 9 test failures in complex scenarios

### Architecture Considerations 📋
- **Performance**: Current implementation suitable for typical use cases
- **Memory Usage**: Value system designed for efficient object representation  
- **Extensibility**: Clean separation allows adding new object parsing strategies
- **Maintainability**: Well-structured codebase follows BAML reference patterns

## Recommendations for 02-Object-Class-Parsing

### Phase 1: Fix Existing Issues (1-2 days)
1. **Resolve Import Path Inconsistencies**: Update test files to use correct import paths
2. **Fix Complex Object Edge Cases**: Address the 9 failing test scenarios
3. **Enhance Malformed JSON Recovery**: Improve state machine parsing for nested objects

### Phase 2: Add Missing Core Features (3-5 days)  
1. **Implement Union Object Resolution**: Scoring-based object type selection system
2. **Add Field Alias Support**: Flexible field name mapping and normalization
3. **Enhance Recursive Object Support**: Circular reference detection with `z.lazy()` schemas

### Phase 3: Advanced Object Features (2-3 days)
1. **Discriminated Union Support**: Automatic discriminator field detection
2. **Streaming Object Construction**: Enhanced partial parsing capabilities  
3. **Performance Optimization**: Large object processing efficiency improvements

**Total Estimated Effort**: 6-10 days for complete 02-object-class-parsing implementation

The codebase is well-architected and ready for object parsing enhancement. The existing multi-strategy parser, Value system, and type coercion provide an excellent foundation for implementing the remaining object parsing features.