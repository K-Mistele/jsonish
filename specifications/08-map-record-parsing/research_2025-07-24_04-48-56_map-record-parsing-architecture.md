---
date: 2025-07-24T04:48:56+0000
researcher: Claude Code
git_commit: d53a90dd5e86dba3eef4dd90576650f5b5ca57e1
branch: master
repository: jsonish
topic: "Map/Record Parsing Architecture and Implementation Analysis"
tags: [research, codebase, map-parsing, record-parsing, coercer, zod, union-resolution, type-coercion]
status: complete
last_updated: 2025-07-24
last_updated_by: Claude Code
type: research
---

# Research: Map/Record Parsing Architecture and Implementation Analysis

**Date**: 2025-07-24T04:48:56+0000  
**Researcher**: Claude Code  
**Git Commit**: d53a90dd5e86dba3eef4dd90576650f5b5ca57e1  
**Branch**: master  
**Repository**: jsonish

## Research Question

Based on the feature.md document in specifications/08-map-record-parsing, research the original BAML Rust codebase and understand how map/record parsing relates to the original rust code, what the relevant architecture and sources are that should be looked at when creating the implementation plan, and what other pertinent details need to be known. Analyze the existing TypeScript implementation and identify implementation gaps.

## Summary

Map/record parsing in the JSONish parser represents dynamic key-value structures through Zod record schemas (`z.record()`). The Rust implementation provides a sophisticated architecture with robust key coercion, value type validation, union resolution, and error recovery. The TypeScript implementation has a solid foundation but contains critical gaps including missing key coercion logic, incomplete error recovery, and parser integration issues that prevent 4 out of 47 test cases from passing.

## Detailed Findings

### Core Architecture - Rust Implementation

The Rust map coercer (`coerce_map.rs:15-117`) implements a sophisticated key-value processing pipeline:

#### Key Processing Logic
- **Key Type Validation** (`coerce_map.rs:40-60`): Supports string, enum, and literal string keys with recursive union type validation
- **Automatic Key Coercion** (`coerce_map.rs:88-107`): Converts all keys to strings through target key type validation
- **Error Tracking**: Uses `MapKeyParseError` flags for failed key coercion while continuing to process other entries

#### Value Coercion Integration  
- **Delegated Processing** (`coerce_map.rs:69-77`): Value coercion delegated to appropriate sub-coercers through recursive type system
- **Context Scoping** (`mod.rs:49-58`): Each map entry creates new parsing context scope for precise error location tracking
- **Graceful Degradation**: Failed value coercion logs error but continues processing other map entries

#### Error Recovery Strategy
- **Flag-Based Error Handling** (`deserialize_flags.rs:20-21`): Uses `MapKeyParseError` and `MapValueParseError` flags instead of immediate failures
- **Partial Success Model**: Maps with some failed keys/values remain usable
- **Scope-Aware Errors**: Precise error location tracking through scope vectors

### TypeScript Implementation Analysis

#### Current Status
The TypeScript map coercer (`src/deserializer/coercer/coerce_map.ts:11-90`) provides basic functionality but has significant gaps:

**Working Features:**
- Basic object-to-map coercion for simple key-value pairs
- Value coercion through existing coercer system  
- Array-to-map conversion for specific `{key, value}` patterns
- Integration with Zod record schemas

**Critical Missing Features:**
1. **Key Coercion Not Implemented** (`coerce_map.ts:32`): Keys used directly as strings without coercion through `keyCoercer`
2. **Enum/Literal Key Support**: No handling for `z.record(z.enum(...), valueType)` or literal union keys
3. **String-to-Map Extraction**: No attempt to parse string input as JSON for map extraction
4. **Parser Integration Issues**: Empty/invalid input returns string type instead of attempting map parsing

#### Test Results Analysis
- **38 of 42 tests pass** - Good foundation
- **4 critical failures**:
  - Map with class object values (empty object returned)
  - Optional values (schema validation error)  
  - Empty input graceful handling (string type returned)
  - Invalid JSON graceful handling (string type returned)

### Union Type Resolution Architecture

#### Scoring System Integration
Both Rust and TypeScript use flag-based scoring for union resolution:

**Map-Specific Penalties:**
- **ObjectToMap**: +1 point (Rust) / +2 points (TypeScript) - Object-to-map conversion penalty
- **MapKeyParseError**: +1 point - Key parsing failure
- **MapValueParseError**: +1 point - Value parsing failure

#### Map vs Object Discrimination
Test evidence from `test_maps.rs:117-190` shows classes consistently win over maps in union resolution due to:
1. **ObjectToMap penalty**: Maps automatically incur conversion penalty
2. **Type coercion costs**: Converting values like `1` to `"1"` for map string values adds penalties
3. **Exact field matching**: Classes with defined fields match perfectly without penalties

### Parser Integration Flow

#### Rust Processing Pipeline
1. **Raw Input → Parser** (`entry.rs:25-50`): JSON attempt, markdown extraction, multi-JSON, fixing parser, string fallback
2. **Value Representation** (`value.rs:27`): Objects as `Vec<(String, Value)>` maintaining key order
3. **Type Routing** (`field_type.rs:101`): `TypeIR::Map(..)` routes to map coercer
4. **Map Processing** (`coerce_map.rs:66-108`): Key validation, value coercion, error tracking
5. **Result Assembly**: Final map with metadata and flags

#### TypeScript Integration Issues
- **Parser Priority** (`parser/index.ts:39-41`): String schema priority may interfere with map parsing
- **Missing ObjectToMap Flag**: TypeScript doesn't automatically add this flag like Rust implementation
- **Incomplete Error Recovery**: Falls back to `errorUnexpectedType` too quickly

## Code References

### Rust Implementation (BAML Original)
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_map.rs:15-117` - Core map coercion algorithm
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_map.rs:40-60` - Key type validation logic
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_map.rs:88-107` - Key coercion pipeline
- `baml/engine/baml-lib/jsonish/src/deserializer/types.rs:28-32` - Map data structure with metadata
- `baml/engine/baml-lib/jsonish/src/deserializer/score.rs:23` - Map scoring integration
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/array_helper.rs:38-265` - Union resolution priority rules
- `baml/engine/baml-lib/jsonish/src/tests/test_maps.rs:117-190` - Map vs class union test evidence

### TypeScript Implementation (Current)
- `src/deserializer/coercer/coerce_map.ts:32` - Missing key coercion implementation
- `src/deserializer/coercer/coerce_map.ts:44-74` - Limited array-to-map conversion patterns
- `src/deserializer/types.ts:210-242` - Scoring system integration
- `src/deserializer/deserialize_flags.ts:121` - MapKeyParseError flag defined but unused
- `test/maps.test.ts:120-130` - Critical key coercion test case
- `test/maps.test.ts:289-316` - Map vs object union resolution tests

## Parser Flow

### Complete Processing Pipeline
1. **Raw Input** → `entry_parser.ts` → JSON parsing attempt with fallbacks
2. **Value Extraction** → `fixing-parser` → Error recovery for malformed JSON
3. **Value Representation** → `Value` construction with completion state
4. **Type Detection** → `deserializer.ts` → Schema matching and routing
5. **Map Coercion** → `coerce_map.ts` → Key processing and value coercion
6. **Union Resolution** → `coerce_union.ts` → Score calculation and best match selection
7. **Final Assembly** → Map structure with flags and metadata

### Key Coercion Requirements
Based on test analysis (`test/maps.test.ts:120-130`):
- Numbers to strings: `5` → `"5"`
- Decimals preserved: `2.17` → `"2.17"`  
- Null coercion: `null` → `"null"`
- Special characters preserved in keys
- Whitespace and newlines maintained

## Architecture Insights

### Sophisticated Error Recovery
- **Partial Success Model**: Continue processing despite individual failures
- **Flag-Based Reporting**: Errors accumulated as flags rather than immediate failures
- **Hierarchical Error Context**: Precise error location through scope tracking
- **Graceful Degradation**: Maps with failed entries remain usable

### Performance Optimizations
- **Lazy Evaluation**: Key type validation only when necessary
- **Score-Based Early Termination**: Union resolution with scoring cutoffs
- **Memory Efficiency**: Strategic flag placement to avoid excessive metadata
- **Context Reuse**: Scope management without excessive cloning

### Type System Integration
- **Schema-Driven Coercion**: Values coerced to match Zod schema expectations
- **Union Scoring**: Quantitative approach to ambiguous type resolution
- **Recursive Processing**: Seamless handling of nested map structures
- **Constraint Validation**: Integration with Jinja expression evaluation

## Critical Implementation Requirements

### Missing TypeScript Features
1. **Key Coercer Integration**: Implement actual key coercion through `keyCoercer.coerce()`  
2. **String-to-JSON Extraction**: Parse string inputs as potential JSON objects
3. **Parser Integration Fix**: Resolve string type priority issues
4. **ObjectToMap Flag**: Add automatic flag for object-to-map conversion
5. **Enum/Literal Key Support**: Handle constrained key schemas
6. **Advanced Error Recovery**: Implement more coercion strategies before failure

### Test-Driven Requirements (47 test scenarios)
- **Key Coercion**: Handle numeric, null, and complex key types
- **Value Type Flexibility**: Support objects, arrays, unions, optionals
- **Nested Structures**: Map-of-maps and complex nesting
- **Error Recovery**: Malformed JSON, incomplete structures, mixed content
- **Union Resolution**: Map vs object discrimination with proper scoring

### Performance Considerations
- **Dynamic Key Efficiency**: Handle arbitrary key sets without performance degradation
- **Memory Management**: Proper handling of large maps without leaks
- **Validation Performance**: Fast Zod schema validation integration
- **Nested Structure Performance**: Efficient recursive processing

## Related Documentation

- `specifications/08-map-record-parsing/feature.md` - Comprehensive feature requirements and test specifications
- `CLAUDE.md` - JSONish architecture overview and development guidelines
- `specifications/requirements.md` - Parent requirements document with schema integration requirements
- `test/maps.test.ts` - 47 test scenarios defining expected behavior patterns

## Related Research

- `specifications/02-object-class-parsing/research_2025-07-24_03-23-13_rust-object-class-parsing-architecture.md` - Object parsing architecture for comparison
- `specifications/06-union-type-resolution/research_2025-07-23_23-21-13_rust-union-type-resolution-architecture.md` - Union resolution system integration

## Open Questions

1. **Performance Impact**: How does the sophisticated key coercion affect performance for large maps?
2. **Memory Usage**: What is the memory overhead of the flag-based error system for maps with many failed entries?
3. **Streaming Integration**: How do partial maps integrate with the streaming parser system?
4. **Constraint Performance**: What is the performance impact of Jinja expression evaluation for map constraints?
5. **Union Edge Cases**: Are there ambiguous cases where map vs object resolution could be improved?

This research reveals that map/record parsing is a sophisticated feature requiring careful implementation of key coercion, value validation, union resolution, and error recovery to match the original Rust implementation's robust behavior.