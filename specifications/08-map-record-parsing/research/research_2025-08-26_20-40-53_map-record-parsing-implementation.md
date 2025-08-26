---
date: 2025-08-26 20:40:53 UTC
researcher: Claude Code
git_commit: 6afccb55f0b88eb08dfebd5cc50b4cd0fe5c5c5b
branch: master
repository: jsonish
topic: "Map/Record Parsing Implementation Analysis and Strategy"
tags: [research, codebase, map-parsing, record-parsing, coercer, union-resolution, zod, type-coercion]
status: complete
last_updated: 2025-08-26
last_updated_by: Claude Code
type: research
---

# Research: Map/Record Parsing Implementation Analysis and Strategy

**Date**: 2025-08-26 20:40:53 UTC
**Researcher**: Claude Code
**Git Commit**: 6afccb55f0b88eb08dfebd5cc50b4cd0fe5c5c5b
**Branch**: master
**Repository**: jsonish

## Research Question
Deeply research the rust jsonish implementation to understand how it's designed and how it works, and then research the existing typescript jsonish codebase to understand what exists, what's there, and what needs to be changed in order to implement the feature for map/record parsing.

## Summary
Based on comprehensive research of both the Rust JSONish implementation and existing TypeScript codebase, map/record parsing support is completely missing from the current TypeScript implementation. The feature requires implementing `z.record()` schema support with key validation, value coercion, union resolution integration, and error recovery mechanisms. The Rust implementation provides a sophisticated two-phase approach (`try_cast` + `coerce`) with comprehensive error flag tracking and intelligent union resolution through weighted scoring systems.

## Detailed Findings

### Rust Implementation Architecture Analysis

#### Core Map Coercion System (`baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_map.rs`)

- **Two-Phase Processing** (lines 15-190):
  - `try_cast_map()`: Fast-path validation without transformation
  - `coerce_map()`: Full coercion with error recovery and flag collection
- **Key Type Validation** (lines 113-133):
  - Only String, Enum, and Literal String keys supported  
  - Union keys must be all literal strings (recursive validation)
  - Invalid key types fail immediately in `try_cast` phase
- **Dynamic Key Processing** (lines 152-181):
  - All keys coerced from strings to target key type
  - Key validation failures logged as `MapKeyParseError` but processing continues
  - Enum keys validated against enum variants with fuzzy matching

#### Sophisticated Scoring System (`baml/engine/baml-lib/jsonish/src/deserializer/score.rs`)

- **Flag-Based Penalties**:
  - `ObjectToMap`: +1 penalty for object-to-map coercion
  - `MapKeyParseError`: +1 penalty per invalid key
  - `MapValueParseError`: +1 penalty per invalid value  
  - Lower scores preferred (better quality)
- **Union Resolution Algorithm** (`baml/engine/baml-lib/jsonish/src/deserializer/coercer/array_helper.rs`):
  - List preferences: Real arrays > single-to-array conversions
  - Object quality: Parsed content > default-filled objects
  - Type conversion penalties: Composite types > converted primitives
  - Markdown handling: Parsed content > raw markdown strings

#### Error Recovery and Edge Cases

- **Malformed JSON Handling**:
  - Continues processing on individual key/value failures
  - Collects error flags without failing entire map
  - Propagates completion states for streaming scenarios
- **Test Coverage** (`baml/engine/baml-lib/jsonish/src/tests/test_maps.rs`):
  - 65+ test scenarios covering basic maps, dynamic keys, enum keys, complex values
  - Edge cases: empty maps, newlines in keys, quoted keys with escapes, mixed content extraction
  - Union resolution: map vs class discrimination with proper scoring

### TypeScript Implementation Gap Analysis

#### Current Parser Architecture (`jsonish/src/parser.ts`)

- **Multi-Strategy System** (lines 15-130):
  - 7 fallback strategies from JSON.parse() to string fallback
  - Value-centric design: Raw input → Value → Coerced output
  - ParsingContext system for circular reference detection
- **Coercion Dispatcher** (lines 522-609):
  - Type-specific coercion routing based on Zod schema instanceof checks
  - **MISSING**: No `z.ZodRecord` detection or handling
  - Supports: String, Number, Boolean, Object, Array, Union, Enum, Literal, Optional, Nullable, Lazy

#### Value System Integration (`jsonish/src/value.ts`)

- **Internal Representation**:
  - Object type: `{ type: 'object', entries: [string, Value][], completion: CompletionState }`
  - Factory functions ready for map conversion: `createObjectValue()`, `createValueFromParsed()`
  - Completion state tracking supports streaming/partial parsing

#### Union Resolution System (`jsonish/src/parser.ts` lines 876-990)

- **Current Implementation**:
  - Simple additive scoring system in `calculateUnionScore()`
  - Basic type matching without weighted penalties
  - No flag-based quality tracking
- **Limitations**:
  - Missing sophisticated heuristics from Rust `pick_best` logic
  - No special handling for map vs object discrimination
  - Lacks penalty-based scoring for transformation quality

### Map Test Requirements Analysis (`test/maps.test.ts`)

#### Core Functionality Requirements (65 test scenarios)

**Basic Map Operations**:
- Simple string maps: `z.record(z.string())` → `{"key1": "value1", "key2": "value2"}`  
- Typed value maps: `z.record(z.number())` with automatic value coercion
- Empty map handling: `{}` inputs properly parsed
- Escaped quote support: `{""a"": ""b""}` with JSON fixing

**Dynamic Key Support**:
- Special characters: `{"key.with.dots": "value1", "key-with-dashes": "value2"}`
- Whitespace preservation: `{"key with spaces": "value1", " leading space": "value2"}`  
- Key type coercion: `{5: "b", 2.17: "e", null: "n"}` → `{"5": "b", "2.17": "e", "null": "n"}`
- Unicode support: Full Unicode character support in keys

**Enum and Literal Key Constraints**:
- Enum keys: `z.record(z.enum(["A", "B"]), z.string())` with validation
- Literal union keys: `z.record(z.union([z.literal("A"), z.literal("B")]), z.string())`
- Key validation with proper error reporting

**Complex Value Types**:
- Nested objects: `{"person1": {"name": "Alice", "age": 30}}`
- Array values: `{"fruits": ["apple", "banana"], "vegetables": ["carrot"]}`  
- Union values: Mixed string/number values in same map
- Optional values: `z.record(z.string().optional())` with null/undefined handling

**Union Type Integration**:
- Map vs object discrimination: `z.union([z.record(z.string()), z.object({a:z.string(), b:z.string()})])`
- Priority resolution: Object schemas win for exact field matches
- Scoring integration: Maps get `ObjectToMap` penalty in union contexts

## Code References

- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_map.rs:15-190` - Core map coercion implementation
- `baml/engine/baml-lib/jsonish/src/deserializer/score.rs:44-56` - Map-specific scoring flags and penalties  
- `baml/engine/baml-lib/jsonish/src/deserializer/coercer/array_helper.rs:26-287` - Advanced union resolution algorithm
- `jsonish/src/parser.ts:522-609` - TypeScript coercion dispatcher (missing ZodRecord)
- `jsonish/src/parser.ts:876-990` - Current union resolution system (needs enhancement)
- `jsonish/src/value.ts:3-12` - Value system ready for map support
- `test/maps.test.ts` - Comprehensive test suite (65 scenarios across 13 test groups)

## Parser Flow Analysis

### Current TypeScript Flow
1. Raw input → Multi-strategy parsing → Value construction
2. Value → `coerceValue()` dispatcher → schema-specific coercion
3. Schema validation → Zod parsing → typed result
4. **Gap**: No `z.record()` handling in step 2

### Required Map Flow Integration  
1. Raw input → Value construction (existing)
2. `z.ZodRecord` detection → `coerceRecord()` function (NEW)
3. Key validation + Value coercion → Record construction (NEW)
4. Union scoring integration → Best match selection (ENHANCED)
5. Zod validation → typed result (existing)

### Rust Reference Flow
1. Input validation → `try_cast_map()` → type compatibility check
2. Object entries → key/value coercion → flag collection
3. Error recovery → partial map construction → completion state propagation
4. Union scoring → weighted penalty calculation → best match selection

## Architecture Insights

### Key Design Patterns from Rust Implementation

**Error Recovery Strategy**:
- Continue processing despite individual failures
- Collect error flags without failing entire operation
- Provide partial results with quality metadata

**Two-Phase Processing**:
- Fast validation path for type checking
- Full coercion path with transformation and error collection
- Optimization for common cases while supporting edge cases

**Flag-Based Quality Tracking**:
- Quantitative penalties for transformation quality
- Weighted scoring system for intelligent union resolution
- Metadata preservation for debugging and optimization

**Streaming/Partial Support**:
- Completion state propagation through nested structures
- Incremental parsing with graceful degradation
- Context-aware processing for circular reference detection

### TypeScript Integration Strategy

**Phase 1: Core Map Coercion**:
```typescript
// Add to parser.ts coerceValue() around line 562
if (schema instanceof z.ZodRecord) {
  return coerceRecord(value, schema, ctx) as z.infer<T>;
}

function coerceRecord<T extends z.ZodRecord<any>>(
  value: Value, 
  schema: T, 
  ctx: ParsingContext
): z.infer<T> {
  // Handle Zod v4 API inconsistency
  const keySchema = schema.keySchema ?? z.string();
  const valueSchema = schema.valueSchema ?? schema._def.type;
  
  // Object-to-map conversion with validation
  // Key coercion and value coercion
  // Error collection and recovery
}
```

**Phase 2: Enhanced Union Resolution**:
```typescript
// Implement flag-based scoring system
interface ParsingFlag {
  type: 'ObjectToMap' | 'ImpliedKey' | 'DefaultFromNoValue' | 'UnionMatch';
  penalty: number;
  metadata?: any;
}

function calculateWeightedScore(value: Value, schema: z.ZodType, flags: ParsingFlag[]): number {
  let baseScore = getTypeCompatibilityScore(value, schema);
  const flagPenalty = flags.reduce((sum, flag) => sum + flag.penalty, 0);
  return baseScore + flagPenalty;
}
```

**Phase 3: Integration Testing**:
- Port all 65 test scenarios from `maps.test.ts`
- Verify union resolution behavior matches Rust implementation  
- Ensure streaming/partial parsing compatibility

## Related Documentation

- `CLAUDE.md` - JSONish architecture and Zod integration patterns
- `specifications/08-map-record-parsing/feature.md` - Complete feature specification with test requirements
- `specifications/requirements.md` - Parent requirements for schema integration and type coercion

## Related Research

- `specifications/06-union-type-resolution/research/research_2025-08-26_12-33-38_union-type-resolution-analysis.md` - Union resolution system analysis
- `specifications/02-object-class-parsing/research/research_2025-08-26_01-53-54_rust-implementation-analysis.md` - Rust object parsing patterns

## Open Questions

1. **Zod v4 API Handling**: How to handle the `z.record(valueSchema)` vs `z.record(keySchema, valueSchema)` API inconsistency where the value schema is stored in `keyType`?

2. **Union Scoring Integration**: Should map coercion penalties integrate with the existing `calculateUnionScore()` system or require a complete rewrite to match Rust's sophisticated algorithm?

3. **Performance Optimization**: How to balance the comprehensive error recovery and flag tracking of the Rust implementation with TypeScript performance requirements?

4. **Streaming Compatibility**: How to ensure map parsing works properly with the existing streaming/partial parsing infrastructure for incomplete JSON inputs?

5. **Error Message Quality**: How to provide clear, actionable error messages for map validation failures while maintaining the fault-tolerant parsing behavior?