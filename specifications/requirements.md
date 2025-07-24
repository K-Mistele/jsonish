---
date: 2025-01-23T22:47:00-08:00
researcher: Claude Code
git_commit: 4e974c5db60f8c7dd723a17d38948bae5afc488f
branch: master
repository: jsonish
topic: "JSONish TypeScript Parser Requirements"
tags: [requirements, specification, json-parser, typescript, tdd, zod-schemas]
status: complete
last_updated: 2025-01-23
last_updated_by: Claude Code
type: requirements
---

# Requirements for JSONish TypeScript Parser

## Goal
Create a production-ready TypeScript port of BAML's Rust-based JSONish parser that handles malformed JSON, mixed content, and intelligent type coercion with 100% test coverage (412/412 tests passing) using Test-Driven Development.

## Important Context
Note: This is a TypeScript library project with all paths relative to the root directory.

### Current Implementation Status
**Critical Regression State**: Architecture refactoring has caused test regression from 98.5% to 92.5% pass rate in `test/basics.test.ts` (62/67 tests passing). The fixing parser implementation is incomplete, causing failures in:
- String priority logic (1 test failure)
- Multi-object parsing (2 test failures) 
- Complex parsing scenarios (2 test failures)

**Overall Test Status**: ~180/412 tests passing (~43.7% pass rate) - NOT PRODUCTION-READY

### Architecture Pattern
The TypeScript implementation follows the Rust parser architecture:
- **Entry Point**: `src/jsonish/parser/entry.ts` - Main parsing coordination
- **Fixing Parser**: `src/jsonish/parser/fixing-parser/` - Error recovery and malformed JSON handling
- **Value System**: `src/jsonish/value.ts` - Internal representation matching Rust Value enum
- **Deserializer**: `src/deserializer/` - Schema-aware type coercion using Zod

### Data Model
- **Parser Options**: `src/deserializer/deserialize_flags.ts` - Parsing configuration flags
- **Scoring System**: `src/deserializer/score.ts` - Type matching scores for union resolution
- **Coercer Types**: `src/deserializer/coercer/` - Type-specific conversion implementations

## Core Library Capabilities

The JSONish parser is a schema-aware JSON parsing library that provides intelligent parsing and type coercion capabilities:

### Schema-Aware Parsing
- **Input-Schema Matching**: Takes any Zod schema and coerces parsed JSON data to match the expected output structure
- **Intelligent Type Coercion**: Converts between compatible types (string numbers to numbers, case variations in booleans/enums, single values to arrays)
- **Union Type Resolution**: Automatically selects the best matching type from union schemas based on data structure and scoring algorithm

### Malformed JSON Recovery
- **Error Recovery**: Handles common JSON formatting issues (trailing commas, missing quotes, unquoted keys, incomplete structures)
- **Comment Support**: Parses JSON with interlinear comments and other non-standard formatting
- **Partial/Streaming JSON**: Processes incomplete JSON structures for real-time scenarios

### Mixed Content Extraction
- **Text Extraction**: Finds and extracts JSON from natural language text and markdown
- **Code Block Support**: Handles JSON within markdown code blocks and multi-line string literals
- **Multiple Object Parsing**: Processes sequences of JSON objects in single input as arrays

## Requirements

### Functional Requirements

#### Core Parsing Engine
- **Multi-Strategy Parser**: Must implement entry.ts with multiple parsing strategies (standard JSON, fixing parser, multi-object parser)
- **Error Recovery**: Must complete fixing parser implementation to handle malformed JSON with state machine approach
- **Value Representation**: Must maintain internal Value type system that matches Rust implementation exactly
- **Completion Tracking**: Must track parsing completion state for streaming scenarios

#### Schema Integration
- **Zod Schema Support**: Must accept any Zod schema and perform type coercion to match expected structure
- **Type Coercion System**: Must implement all coercer types (primitive, array, literal, map, union, enum, class, alias)
- **Scoring Algorithm**: Must use scoring system to resolve ambiguous type matches, especially for unions
- **Validation**: Must validate final output against provided schema and return proper error messages

#### Content Extraction
- **Mixed Content Parsing**: Must extract JSON from text containing natural language or markdown
- **Code Block Extraction**: Must handle JSON within markdown code blocks (```json)
- **Multi-line String Support**: Must handle Python-style triple quotes and JavaScript template literals
- **Pattern Recognition**: Must identify JSON-like structures in various text formats

#### Advanced Features
- **Streaming Support**: Must parse incomplete JSON for real-time scenarios with partial completion tracking
- **Multi-Object Parsing**: Must handle multiple top-level JSON objects in single input as array
- **String Priority Logic**: Must prioritize string schema when content could be parsed multiple ways
- **Recursive Parsing**: Must handle deeply nested structures and circular references safely

### Non-Functional Requirements

#### Performance
- **Test Suite Performance**: Must achieve 100% pass rate across all 412 test cases for production readiness
- **Memory Efficiency**: Must handle large JSON structures without excessive memory usage
- **Parsing Speed**: Must maintain reasonable parsing performance compared to standard JSON.parse for valid JSON

#### Error Handling & Reliability
- **Graceful Degradation**: Must never throw uncaught exceptions, always return results or structured errors
- **Error Recovery**: Must attempt to fix common JSON errors automatically before failing
- **Validation Errors**: Must provide clear, actionable error messages when schema validation fails
- **State Consistency**: Must maintain consistent internal state during parsing failures

#### Developer Experience
- **TypeScript Types**: Must provide complete TypeScript type definitions with proper generic support
- **API Consistency**: Must match the API design shown in README examples exactly
- **Documentation**: Must maintain inline code documentation matching existing patterns
- **Test Coverage**: Must maintain comprehensive test coverage for all features and edge cases

#### Code Quality
- **Rust Parity**: Must match the exact behavior of the original Rust implementation for all test cases
- **Architecture Alignment**: Must follow the same module structure and design patterns as Rust codebase
- **Code Style**: Must follow Biome formatting (4-space indentation, single quotes, 120 char width)
- **ES Module Support**: Must use proper ES module imports/exports, no CommonJS require()

## Design Considerations

### Architecture & Module Structure
- **Parser Hierarchy**: Entry parser coordinates between standard JSON parser, fixing parser, and multi-object parser
- **Coercer System**: Individual coercer modules handle type-specific conversions with clear separation of concerns
- **Value System**: Internal Value representation provides unified interface between parser and deserializer
- **Flag-Based Configuration**: Parsing behavior controlled through structured flags rather than boolean options

### Error Recovery Strategy
- **State Machine Approach**: Fixing parser uses state machine to track parsing progress and attempt corrections
- **Incremental Fixes**: Apply fixes incrementally (add missing commas, close brackets, handle quotes) rather than wholesale string manipulation
- **Fallback Mechanisms**: Multiple parsing strategies with fallback from strict to permissive approaches
- **Context Preservation**: Maintain parsing context to provide meaningful error messages and recovery suggestions

### Type Resolution Logic
- **Schema-First Approach**: Use provided Zod schema as primary guide for type coercion decisions
- **Scoring System**: Quantitative scoring for type matches enables consistent union type resolution
- **Priority Rules**: Clear priority order (string schema priority, exact matches over coerced matches)
- **Validation Integration**: Tight integration between parsing and Zod validation for immediate feedback

### Development Process & Testing Strategy
- **Sequential Test File Approach**: Work through test files one at a time in dependency order, starting with `test/basics.test.ts`
- **No Test Modification**: Tests must NOT be modified without explicit user permission (e.g., if changing function names/imports for schema-aware parsing)
- **Regression Prevention**: Must fix current 5 test failures in basics.test.ts before proceeding to other test files
- **Rust Behavioral Parity**: All implementations must exactly match the behavior of the original Rust parser
- **Test-Driven Development**: Implementation guided by existing comprehensive test suite (236+ tests across 12+ categories)
- **Progressive Implementation**: Only proceed to next test file after achieving 100% pass rate in current file

## Success Criteria

### Core Functionality Recovery
- **Immediate Goal**: Fix regression to achieve 67/67 tests passing in basics.test.ts (100% pass rate)
- **String Priority**: Correctly handle string schema priority for mixed content scenarios
- **Multi-Object Parsing**: Successfully parse multiple JSON objects in single input as array
- **Complex Scenarios**: Handle triple-quoted strings and complex malformed JSON sequences

### Production Readiness
- **Full Test Suite**: Achieve 412/412 tests passing across all test files (100% pass rate)
- **Behavioral Parity**: Match Rust implementation behavior exactly for all documented test cases
- **API Completeness**: Support all parser options and features documented in README
- **Error Handling**: Graceful handling of all edge cases without uncaught exceptions

### Technical Implementation
- **Architecture Completion**: Complete fixing parser implementation with proper state machine logic
- **Module Integration**: Proper integration between parser components and deserializer system
- **Type Safety**: Full TypeScript type safety with generic schema support
- **Performance**: Acceptable performance characteristics for production use cases

### Developer Experience
- **Documentation Accuracy**: README examples work exactly as documented
- **API Stability**: Consistent API that matches the intended design patterns
- **Error Messages**: Clear, actionable error messages for validation failures
- **Debugging Support**: Adequate logging and debugging information for troubleshooting