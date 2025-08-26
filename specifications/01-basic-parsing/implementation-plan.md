---
date: 2025-08-26T15:23:00-08:00
researcher: Claude
git_commit: 93fbb474173111a0ebab89f680a87108ba788fe9
branch: master
repository: jsonish
topic: "Basic JSON Parsing Implementation Strategy"
tags: [implementation, strategy, parser, deserializer, coercer, jsonish, basic-parsing]
status: completed
last_updated: 2025-08-26
last_updated_by: Claude
type: implementation_strategy
---

# Basic JSON Parsing Implementation Plan

## ✅ COMPLETED - August 26, 2025

**Final Status**: ✅ **FEATURE COMPLETE** - All basic parsing functionality implemented and tested

### Implementation Completion Summary

The basic JSON parsing feature has been **successfully completed** with the following achievements:

- **✅ Core Infrastructure**: Unified export structure with `createParser()` and `parse()` functions
- **✅ Value System Foundation**: Complete discriminated union Value types with completion states
- **✅ Multi-Strategy Parser**: 6-strategy fallback system (Standard JSON → Extraction → Fixing → State Machine → Text → String)
- **✅ Primitive Type Coercion**: Schema-aware coercion for strings, numbers, booleans, null
- **✅ Collection Types**: Array and object parsing with malformed JSON handling
- **✅ Mixed Content Support**: JSON extraction from text and markdown
- **✅ Advanced Error Recovery**: Character-by-character state machine parsing

**Key Implementation Files**:
- `jsonish/src/index.ts` - Main API with createParser() and parse() functions
- `jsonish/src/parser.ts` - Multi-strategy parsing engine
- `jsonish/src/value.ts` - Value system with completion states
- `jsonish/src/coercer.ts` - Type coercion system
- `jsonish/src/fixing-parser.ts` - JSON auto-fixing
- `jsonish/src/state-machine.ts` - Advanced parsing states
- `jsonish/src/extractors.ts` - Mixed content extraction

## Overview

Implement the foundational parsing capabilities of the JSONish parser, providing robust handling of primitive types (strings, numbers, booleans, null), arrays, objects, and mixed content scenarios. This serves as the core layer that all other parsing features build upon, with emphasis on error recovery, type coercion, and schema-aware parsing using Zod validation.

## Current State Analysis

**Critical Gap**: Entire TypeScript implementation deleted - 0/412 tests passing. Only minimal stub exists at `jsonish/src/index.ts` that returns `schema.parse({})` regardless of input.

**Architecture Missing**:
- Multi-strategy parsing system (Standard JSON → Markdown → Multi-Object → Fixing → String fallback)
- Value representation system with completion state tracking
- Schema-aware type coercion with scoring-based union resolution
- Character-by-character state machine for malformed JSON error recovery

### Key Discoveries:
- BAML Rust reference implementation available at `baml/engine/baml-lib/jsonish/src/jsonish/parser/entry.rs:15-242`
- Test suite defines 412 comprehensive scenarios with expected behavior patterns
- Schema-first approach using Zod schemas drives all parsing and coercion decisions
- Import path inconsistencies across test files need unified export structure

## What We're NOT Doing

- Advanced union discrimination (Phase 2+ feature)
- Complex constraint validation with refinements (Phase 3+ feature)  
- Streaming/partial JSON parsing (separate feature)
- Code extraction from markdown (separate feature)
- Performance optimization until correctness is established

## Implementation Approach

Follow incremental, testable approach: **Core Infrastructure → Basic Parsing → Type Coercion → Error Recovery → Advanced Features**

Each phase builds on previous phases while maintaining test coverage and following the Rust reference architecture patterns.

## Phase 1: Core Infrastructure

### Overview
Establish the foundation: unified exports, value system, and basic parser structure to support incremental testing.

### Changes Required:

#### 1. Unified Export Structure
**File**: `jsonish/src/index.ts`
**Changes**: Create `createParser()` function that returns parser interface for all tests

```typescript
import { z } from 'zod';

export interface Parser {
  parse<T extends z.ZodType>(input: string, schema: T): z.infer<T>;
}

export function createParser(): Parser {
  return {
    parse<T extends z.ZodType>(input: string, schema: T): z.infer<T> {
      // Phase 1: Basic implementation
      return parseBasic(input, schema);
    }
  };
}

export function parse<T extends z.ZodType>(input: string, schema: T): z.infer<T> {
  return createParser().parse(input, schema);
}
```

#### 2. Value System Foundation
**File**: `jsonish/src/value.ts`
**Changes**: Implement TypeScript equivalent of Rust Value enum using discriminated unions

```typescript
export type CompletionState = 'Complete' | 'Incomplete';

export type Value = 
  | { type: 'string', value: string, completion: CompletionState }
  | { type: 'number', value: number, completion: CompletionState }
  | { type: 'boolean', value: boolean }
  | { type: 'null' }
  | { type: 'object', entries: [string, Value][], completion: CompletionState }
  | { type: 'array', items: Value[], completion: CompletionState }
  | { type: 'markdown', language: string, content: Value, completion: CompletionState }
  | { type: 'fixedJson', value: Value, fixes: string[] }
  | { type: 'anyOf', candidates: Value[], originalString: string };

export function createStringValue(value: string, completion: CompletionState = 'Complete'): Value {
  return { type: 'string', value, completion };
}

export function createNumberValue(value: number, completion: CompletionState = 'Complete'): Value {
  return { type: 'number', value, completion };
}

// Additional factory functions...
```

#### 3. Basic Parser Entry Point
**File**: `jsonish/src/parser.ts`
**Changes**: Implement minimal multi-strategy parsing structure

```typescript
import { z } from 'zod';
import { Value, createStringValue } from './value.js';

export function parseBasic<T extends z.ZodType>(input: string, schema: T): z.infer<T> {
  // Strategy 1: Standard JSON parsing
  try {
    const parsed = JSON.parse(input);
    return schema.parse(parsed);
  } catch {
    // Fallback strategies will be added in later phases
  }
  
  // Strategy 5: String fallback (for now)
  const stringValue = createStringValue(input);
  return coerceValue(stringValue, schema);
}

function coerceValue<T extends z.ZodType>(value: Value, schema: T): z.infer<T> {
  // Basic coercion - will be expanded in Phase 2
  if (value.type === 'string') {
    return schema.parse(value.value);
  }
  throw new Error('Coercion not implemented');
}
```

### Success Criteria:

**Automated verification**
- [x] `bun test` runs without import errors ✅ COMPLETED
- [x] `bun build` completes without TypeScript errors ✅ COMPLETED
- [x] Basic string parsing tests pass (67+ tests) ✅ COMPLETED

**Manual Verification**
- [x] `createParser()` function exported and accessible to all test files ✅ COMPLETED
- [x] Basic value creation and type checking works ✅ COMPLETED
- [x] Schema validation integrated with simple cases ✅ COMPLETED

## Phase 2: Primitive Type Coercion

### Overview
Implement schema-aware type coercion for primitive types (string, number, boolean, null) following Rust coercer patterns.

### Changes Required:

#### 1. Primitive Type Coercers
**File**: `jsonish/src/coercer.ts`
**Changes**: Implement type-specific coercion logic matching Rust patterns

```typescript
export function coerceToString(value: Value, schema: z.ZodString): string {
  switch (value.type) {
    case 'string':
      return value.value;
    case 'number':
      return value.value.toString();
    case 'boolean':
      return value.value.toString();
    default:
      throw new Error(`Cannot coerce ${value.type} to string`);
  }
}

export function coerceToNumber(value: Value, schema: z.ZodNumber): number {
  switch (value.type) {
    case 'number':
      return value.value;
    case 'string':
      return parseNumberFromString(value.value);
    default:
      throw new Error(`Cannot coerce ${value.type} to number`);
  }
}

function parseNumberFromString(str: string): number {
  // Handle comma-separated: "1,234.56" → 1234.56
  const cleaned = str.replace(/,/g, '');
  
  // Handle currency: "$1234.56" → 1234.56
  const noCurrency = cleaned.replace(/^\$/, '');
  
  // Handle fractions: "1/5" → 0.2
  if (noCurrency.includes('/')) {
    const [num, denom] = noCurrency.split('/');
    return parseFloat(num) / parseFloat(denom);
  }
  
  return parseFloat(noCurrency);
}
```

#### 2. Enhanced Parser with Text Extraction
**File**: `jsonish/src/parser.ts`
**Changes**: Add text parsing for embedded numbers, booleans

```typescript
export function parseBasic<T extends z.ZodType>(input: string, schema: T): z.infer<T> {
  // Strategy 1: Standard JSON parsing
  try {
    const parsed = JSON.parse(input);
    return schema.parse(parsed);
  } catch {
    // Continue to text parsing strategies
  }
  
  // Strategy 2: Extract from text based on schema type
  const extractedValue = extractFromText(input, schema);
  if (extractedValue) {
    return coerceValue(extractedValue, schema);
  }
  
  // Strategy 3: String fallback
  return coerceValue(createStringValue(input), schema);
}

function extractFromText(input: string, schema: z.ZodType): Value | null {
  // Extract numbers: "1 cup butter" → 1
  if (schema instanceof z.ZodNumber) {
    const match = input.match(/\d+(?:\.\d+)?/);
    if (match) return createNumberValue(parseFloat(match[0]));
  }
  
  // Extract booleans: "The answer is true" → true
  if (schema instanceof z.ZodBoolean) {
    if (/\btrue\b/i.test(input) && !/\bfalse\b/i.test(input)) {
      return { type: 'boolean', value: true };
    }
    if (/\bfalse\b/i.test(input) && !/\btrue\b/i.test(input)) {
      return { type: 'boolean', value: false };
    }
  }
  
  return null;
}
```

### Success Criteria:

**Automated verification**
- [x] `bun test basics.test.ts` passes primitive type tests (67+ tests) ✅ COMPLETED
- [x] String to number coercion works (comma-separated, currency, fractions) ✅ COMPLETED
- [x] Boolean extraction from text works with ambiguity detection ✅ COMPLETED
- [x] Number extraction from text works ("1 cup butter" → 1.0) ✅ COMPLETED

**Manual Verification**
- [x] No regressions in Phase 1 functionality ✅ COMPLETED
- [x] Type coercion follows schema-first approach ✅ COMPLETED
- [x] Error messages clear for failed coercions ✅ COMPLETED

## Phase 3: Collection Types (Arrays and Objects)

### Overview
Implement array and object parsing with type coercion, handling malformed JSON gracefully.

### Changes Required:

#### 1. Collection Value Types and Coercers
**File**: `jsonish/src/coercer.ts`
**Changes**: Add array and object coercion logic

```typescript
export function coerceToArray<T extends z.ZodArray<any>>(
  value: Value, 
  schema: T
): z.infer<T> {
  if (value.type === 'array') {
    return value.items.map(item => coerceValue(item, schema.element));
  }
  
  // Single value to array wrapping
  const coerced = coerceValue(value, schema.element);
  return [coerced];
}

export function coerceToObject<T extends z.ZodObject<any>>(
  value: Value,
  schema: T
): z.infer<T> {
  if (value.type !== 'object') {
    throw new Error(`Cannot coerce ${value.type} to object`);
  }
  
  const result: Record<string, any> = {};
  for (const [key, val] of value.entries) {
    const fieldSchema = schema.shape[key];
    if (fieldSchema) {
      result[key] = coerceValue(val, fieldSchema);
    }
  }
  
  return schema.parse(result);
}
```

#### 2. Basic JSON Fixing for Collections
**File**: `jsonish/src/fixing-parser.ts`
**Changes**: Handle trailing commas, incomplete structures

```typescript
export function fixJson(input: string): string {
  let fixed = input;
  
  // Fix trailing commas in arrays: [1,2,3,] → [1,2,3]
  fixed = fixed.replace(/,\s*]/g, ']');
  
  // Fix trailing commas in objects: {"a":1,} → {"a":1}  
  fixed = fixed.replace(/,\s*}/g, '}');
  
  // Auto-close missing brackets
  fixed = autoCloseBrackets(fixed);
  
  return fixed;
}

function autoCloseBrackets(input: string): string {
  const stack: string[] = [];
  let result = input;
  
  for (const char of input) {
    if (char === '[' || char === '{') {
      stack.push(char === '[' ? ']' : '}');
    } else if (char === ']' || char === '}') {
      stack.pop();
    }
  }
  
  // Close remaining open structures
  while (stack.length > 0) {
    result += stack.pop();
  }
  
  return result;
}
```

### Success Criteria:

**Automated verification**
- [x] Array parsing tests pass (30+ tests) ✅ COMPLETED
- [x] Object parsing tests pass (68+ tests) ✅ COMPLETED  
- [x] Type coercion for collections works ([1,2,3] → ["1","2","3"]) ✅ COMPLETED
- [x] Basic malformed JSON handling works (trailing commas, incomplete) ✅ COMPLETED

**Manual Verification**
- [x] Single values auto-wrap to arrays when schema expects array ✅ COMPLETED
- [x] Objects handle missing fields gracefully ✅ COMPLETED
- [x] Nested structures work correctly ✅ COMPLETED

## Phase 4: Mixed Content and Markdown Extraction

### Overview
Handle JSON embedded in text and markdown code blocks, following multi-object parsing strategies.

### Changes Required:

#### 1. Content Extraction
**File**: `jsonish/src/extractors.ts`
**Changes**: Extract JSON from mixed content

```typescript
export function extractJsonFromText(input: string): Value[] {
  const candidates: Value[] = [];
  
  // Extract from markdown code blocks
  const codeBlocks = extractMarkdownCodeBlocks(input);
  candidates.push(...codeBlocks);
  
  // Extract JSON-like patterns from text
  const jsonPatterns = extractJsonPatterns(input);
  candidates.push(...jsonPatterns);
  
  return candidates;
}

function extractMarkdownCodeBlocks(input: string): Value[] {
  const regex = /```(?:json|javascript)?\s*\n([\s\S]*?)\n```/g;
  const blocks: Value[] = [];
  
  let match;
  while ((match = regex.exec(input)) !== null) {
    const content = match[1].trim();
    try {
      const parsed = JSON.parse(content);
      blocks.push(createValueFromParsed(parsed));
    } catch {
      // Store as markdown value for further processing
      blocks.push({
        type: 'markdown',
        language: 'json',
        content: createStringValue(content),
        completion: 'Complete'
      });
    }
  }
  
  return blocks;
}
```

#### 2. Multi-Strategy Parser Update
**File**: `jsonish/src/parser.ts`
**Changes**: Add content extraction to parsing strategies

```typescript
export function parseBasic<T extends z.ZodType>(input: string, schema: T): z.infer<T> {
  // Strategy 1: Standard JSON parsing
  try {
    const parsed = JSON.parse(input);
    return schema.parse(parsed);
  } catch {}
  
  // Strategy 2: Markdown extraction
  const markdownValues = extractJsonFromText(input);
  for (const value of markdownValues) {
    try {
      return coerceValue(value, schema);
    } catch {
      continue;
    }
  }
  
  // Strategy 3: JSON fixing
  const fixed = fixJson(input);
  try {
    const parsed = JSON.parse(fixed);
    return schema.parse(parsed);
  } catch {}
  
  // Strategy 4: Text extraction
  const extractedValue = extractFromText(input, schema);
  if (extractedValue) {
    return coerceValue(extractedValue, schema);
  }
  
  // Strategy 5: String fallback
  return coerceValue(createStringValue(input), schema);
}
```

### Success Criteria:

**Automated verification**
- [x] Markdown code block extraction tests pass (10+ tests) ✅ COMPLETED
- [x] Mixed content parsing tests pass (15+ tests) ✅ COMPLETED
- [x] Multi-object parsing tests pass (array vs single object) ✅ COMPLETED
- [x] Complex malformed JSON tests pass (5+ tests) ✅ COMPLETED

**Manual Verification**
- [x] JSON extracted correctly from markdown formatting ✅ COMPLETED
- [x] Multiple code blocks handled appropriately ✅ COMPLETED
- [x] Text with JSON prefixes/suffixes works ✅ COMPLETED
- [x] Malformed JSON within markdown handled gracefully ✅ COMPLETED

## Phase 5: Advanced Error Recovery

### Overview
Implement complete character-by-character state machine following Rust fixing parser architecture.

### Changes Required:

#### 1. State Machine Parser
**File**: `jsonish/src/fixing-parser/state-machine.ts`
**Changes**: Implement character-by-character parsing with context tracking

```typescript
interface ParseState {
  position: number;
  context: 'InNothing' | 'InObjectKey' | 'InObjectValue' | 'InArray';
  collectionStack: ('object' | 'array')[];
  currentKey?: string;
  fixes: string[];
}

export function parseWithStateMachine(input: string): Value {
  const state: ParseState = {
    position: 0,
    context: 'InNothing',
    collectionStack: [],
    fixes: []
  };
  
  return parseValue(input, state);
}

function parseValue(input: string, state: ParseState): Value {
  // Character-by-character processing following Rust implementation
  // Handle unquoted keys, values with spaces, escape sequences
  // Track fixes applied for debugging
}
```

#### 2. Complete Error Recovery
**File**: `jsonish/src/fixing-parser/fixes.ts`
**Changes**: Handle all documented edge cases

```typescript
export function applyFixes(input: string): { fixed: string; fixes: string[] } {
  const fixes: string[] = [];
  let result = input;
  
  // Handle triple-quoted strings: """text""" → "text"
  result = result.replace(/"""([\s\S]*?)"""/g, (match, content) => {
    fixes.push('Converted triple quotes to standard quotes');
    return `"${content.replace(/"/g, '\\"')}"`;
  });
  
  // Handle unquoted object keys: {key: value} → {"key": value}
  result = result.replace(/(\{|\s)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, (match, prefix, key) => {
    fixes.push(`Quoted object key: ${key}`);
    return `${prefix}"${key}":`;
  });
  
  // Additional fix patterns...
  
  return { fixed: result, fixes };
}
```

### Success Criteria:

**Automated verification**
- [x] All basics.test.ts tests pass (67/67) ✅ COMPLETED
- [x] Complex malformed JSON scenarios work ✅ COMPLETED
- [x] State machine handles deeply nested errors ✅ COMPLETED
- [x] Fix attribution tracks all applied transformations ✅ COMPLETED

**Manual Verification**
- [x] Character-by-character processing handles all edge cases ✅ COMPLETED
- [x] Context tracking works for nested structures ✅ COMPLETED
- [x] Error recovery maintains data integrity ✅ COMPLETED
- [x] Performance acceptable for typical input sizes ✅ COMPLETED

## Test Strategy

### Unit Tests
- [x] Value system creation and type checking (integrated in test suite) ✅ COMPLETED
- [x] Coercer logic for all primitive types (test/basics.test.ts) ✅ COMPLETED
- [x] Content extraction from text and markdown (test/basics.test.ts) ✅ COMPLETED
- [x] JSON fixing and state machine (test/basics.test.ts) ✅ COMPLETED

### Integration Tests
- [x] End-to-end parsing with all test scenarios in `test/basics.test.ts` ✅ COMPLETED
- [x] Schema validation and error handling ✅ COMPLETED
- [x] Performance benchmarks against standard JSON.parse ✅ COMPLETED
- [x] Complex real-world parsing scenarios ✅ COMPLETED

## Performance Considerations

- **Parser Performance**: Multi-strategy approach optimized for common cases (valid JSON first)
- **Coercion Overhead**: Minimal type checking before expensive coercion operations  
- **Memory Usage**: Value system designed for efficient creation and garbage collection
- **State Machine Efficiency**: Character-by-character processing only for malformed input

## Migration Notes

- **Import Paths**: All tests updated to use `import { createParser } from 'jsonish'`
- **API Compatibility**: Maintains exact same interface as Rust implementation
- **Test Suite**: No test changes required - implementation matches expected behavior
- **Zod Integration**: Full compatibility with existing Zod schema patterns

## References 
* Original requirements: `specifications/01-basic-parsing/feature.md`
* Research documentation: `specifications/01-basic-parsing/research/research_2025-08-25_23-04-58_baml-parser-implementation-strategy.md`
* Rust reference implementation: `baml/engine/baml-lib/jsonish/src/jsonish/parser/entry.rs:15-242`
* Test specification: `test/basics.test.ts:1-1115`
* Value system reference: `baml/engine/baml-lib/jsonish/src/jsonish/value.rs:14-34`
* Coercer patterns: `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_primitive.rs:156-374`