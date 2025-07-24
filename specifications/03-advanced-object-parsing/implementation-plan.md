---
date: 2025-07-24T17:44:00-07:00
researcher: Claude
git_commit: 4c7a06c47cee073607f39bde051cb68f12a6b1b4
branch: master
repository: jsonish
topic: "Advanced Object Parsing Implementation Strategy"
tags: [implementation, strategy, parser, deserializer, coercer, jsonish, advanced-parsing, discriminated-unions, streaming, mixed-content]
status: complete
last_updated: 2025-07-24
last_updated_by: Claude
type: implementation_strategy
---

# Advanced Object Parsing Implementation Plan

## Overview

This implementation strategy addresses the advanced object parsing capabilities for JSONish, focusing on enhancing discriminated union processing while leveraging the already-excellent streaming, partial parsing, and mixed content extraction implementations. The TypeScript implementation already exceeds most requirements, with the primary gap being sophisticated discriminated union resolution comparable to the Rust architecture.

## Current State Analysis

Based on extensive research of the JSONish TypeScript codebase, **most advanced object parsing features are already comprehensively implemented** with sophisticated architectures that meet or exceed the feature requirements.

### Key Discoveries:

- **Excellent Streaming Architecture**: Complete implementation in `src/jsonish/value.ts:29-33` with CompletionState tracking, state machine parser in `src/jsonish/parser/fixing-parser/json-parse-state.ts:288-504`, and comprehensive test coverage
- **Robust Mixed Content Extraction**: Multi-stage parsing pipeline in `src/jsonish/parser/entry_parser.ts:75-305`, markdown parser `src/jsonish/parser/markdown-parser.ts:54-133`, and multi-JSON parser `src/jsonish/parser/multi-json-parser.ts:15-89`
- **Comprehensive Test Coverage**: 50+ advanced parsing tests in `test/class-2.test.ts:809` lines, exceeding the 11+ test requirement significantly
- **Basic Union Processing**: Working union coercion in `src/deserializer/coercer/union_coercer.ts:14-51` but lacking sophisticated discriminated union optimizations

### Implementation Status:
✅ Streaming and partial parsing with completion states  
✅ Mixed content extraction from markdown and multi-JSON  
✅ Complex schema support with deep nesting  
✅ Comprehensive test coverage (50+ tests vs 11+ required)  
✅ Basic union type resolution with scoring system  
⚠️ **Gap**: Sophisticated discriminated union processing  
⚠️ **Gap**: Fast-path discriminator detection  
⚠️ **Gap**: Alias-based discriminator matching  

## What We're NOT Doing

- Rewriting the streaming/partial parsing system (it's already excellent and comprehensive)
- Changing the mixed content extraction architecture (markdown/multi-JSON parsers work perfectly)
- Modifying the core Value representation system (CompletionState tracking is robust)
- Adding new test infrastructure (current coverage exceeds requirements significantly)
- Rewriting the basic union coercion system (scoring mechanism is solid)

## Implementation Approach

Rather than implementing advanced object parsing from scratch, this strategy focuses on **enhancing discriminated union processing** to match the sophisticated Rust implementation while preserving the excellent existing implementations of streaming, mixed content, and schema processing.

## Phase 1: Enhanced Discriminated Union Processing

### Overview
Upgrade the union coercion system to support fast-path discriminated union resolution, alias-based matching, and structural analysis while maintaining compatibility with existing union processing.

### Changes Required:

#### 1. Discriminator Detection System
**File**: `src/deserializer/coercer/union_coercer.ts`  
**Changes**: Add discriminator field detection and fast-path processing

```typescript
// Add discriminator detection before generic union processing
function detectDiscriminator(target: z.ZodDiscriminatedUnion, value: Value): string | null {
  if (value.type === 'object') {
    const discriminatorKey = target.discriminator
    const field = value.value.find(([key, _]) => key === discriminatorKey)
    if (field && field[1].type === 'string') {
      return field[1].value
    }
  }
  return null
}

// Enhance coerceUnion with discriminator fast-path
function coerceUnion(ctx: ParsingContext, target: z.ZodUnion | z.ZodDiscriminatedUnion, ...): BamlValueWithFlags | ParsingError {
  // Check for discriminated union fast-path
  if (target instanceof z.ZodDiscriminatedUnion) {
    const discriminatorValue = detectDiscriminator(target, value)
    if (discriminatorValue) {
      return coerceDiscriminatedUnion(ctx, target, value, discriminatorValue)
    }
  }
  
  // Fall back to existing generic union processing
  return coerceGenericUnion(ctx, target, value, coercers)
}
```

#### 2. Alias-Based Discriminator Matching
**File**: `src/deserializer/coercer/discriminator_matcher.ts` (new file)  
**Changes**: Create fuzzy matching system for discriminator values

```typescript
// Support for alias-based discriminator matching
export class DiscriminatorMatcher {
  private aliasMap: Map<string, string[]> = new Map()
  
  // Register discriminator aliases (could be loaded from schema annotations)
  registerAlias(discriminatorValue: string, aliases: string[]): void
  
  // Find best match for discriminator value using fuzzy logic
  findBestMatch(inputValue: string, possibleValues: string[]): string | null
  
  // Substring scoring with case-insensitive fallback
  private calculateMatchScore(input: string, candidate: string): number
}
```

#### 3. Multi-Variant Parsing Enhancement
**File**: `src/deserializer/coercer/array_helper.ts`  
**Changes**: Enhance union array processing for mixed discriminated types

```typescript
// Add support for mixed discriminated union arrays
export function coerceDiscriminatedUnionArray(
  ctx: ParsingContext,
  target: z.ZodArray<z.ZodDiscriminatedUnion>,
  values: Value[],
  discriminatorMatcher: DiscriminatorMatcher
): BamlValueWithFlags | ParsingError {
  // Process each array element with discriminator-aware coercion
  // Leverage existing scoring system while optimizing for discriminator detection
}
```

### Success Criteria:

**Automated Verification**
- [ ] `bun test test/class-2.test.ts` passes all 11+ discriminated union tests
- [ ] `bun test test/unions.test.ts` passes all existing union tests  
- [ ] `bun test` passes complete test suite (236+ tests)
- [ ] `bun build` completes without TypeScript errors
- [ ] No performance regression in existing union processing

**Manual Verification**
- [ ] Discriminated unions resolve faster than generic unions for objects with discriminator fields
- [ ] Complex blog system scenarios (server actions, components, pages) parse correctly
- [ ] Mixed-type arrays with discriminator fields process efficiently
- [ ] Alias-based discriminator matching works for flexible field values
- [ ] Error messages remain clear for discriminator validation failures

## Phase 2: Performance and Integration Optimization

### Overview
Optimize the enhanced discriminated union system for production use and ensure seamless integration with existing streaming, mixed content, and schema processing capabilities.

### Potential Improvements:

#### 1. Performance Optimization
**File**: `src/deserializer/coercer/union_coercer.ts`  
**Changes**: Add performance monitoring and optimization for discriminated unions

```typescript
// Cache discriminator detection results for repeated parsing
const discriminatorCache = new Map<string, string | null>()

// Performance metrics for union resolution paths
interface UnionPerformanceMetrics {
  discriminatorHits: number
  genericFallbacks: number
  averageResolutionTime: number
}
```

#### 2. Enhanced Error Messages
**File**: Error handling throughout union coercion pipeline  
**Changes**: Provide discriminator-specific error messages

```typescript
// Enhanced error context for discriminated union failures
function createDiscriminatorError(
  discriminatorField: string,
  expectedValues: string[],
  actualValue: string
): ParsingError {
  return new ParsingError(
    `Invalid discriminator value "${actualValue}" for field "${discriminatorField}". Expected one of: ${expectedValues.join(', ')}`
  )
}
```

#### 3. Integration Testing
**File**: `test/advanced-discriminated-unions.test.ts` (new file)  
**Changes**: Add integration tests for discriminated unions with streaming and mixed content

```typescript
// Test discriminated unions in streaming scenarios
// Test discriminated unions extracted from markdown
// Test performance comparisons between discriminated and generic unions
```

### Success Criteria:

**Automated Verification**
- [ ] All enhanced discriminated union tests pass
- [ ] Performance benchmarks show improvement over generic union processing
- [ ] Integration with streaming parser maintains completion state tracking
- [ ] Mixed content extraction works seamlessly with discriminated unions
- [ ] No memory leaks or performance degradation in long-running scenarios

**Manual Verification**
- [ ] Error messages provide clear guidance for discriminator issues
- [ ] Performance improvement is measurable for real-world discriminated union scenarios
- [ ] Integration with existing JSONish features remains seamless
- [ ] Code is well-documented for future maintainers

## Test Strategy

### Current Test Coverage Status
The existing test suite already provides **comprehensive coverage that exceeds requirements**:

- **11+ Discriminated Union Tests**: ✅ Already implemented in `test/class-2.test.ts`
- **Streaming Tests**: ✅ Comprehensive coverage in `test/streaming.test.ts` (45+ tests)
- **Partial Parsing Tests**: ✅ Extensive coverage in `test/partials.test.ts` (25+ tests)
- **Mixed Content Tests**: ✅ Advanced scenarios in multiple test files
- **Performance Tests**: ⚠️ Implicit through large document processing

### Enhancement Testing Strategy
1. **Discriminator Performance Tests**: Validate fast-path optimization effectiveness
2. **Integration Tests**: Ensure discriminated unions work with streaming and mixed content
3. **Regression Tests**: Verify no breaks to existing union processing
4. **Error Message Tests**: Validate improved error reporting for discriminator issues

## Performance Considerations

The current implementation already demonstrates excellent performance characteristics:
- **Lazy evaluation** for complex union resolution prevents unnecessary computation
- **Completion state tracking** enables efficient streaming without re-parsing
- **Multi-stage parsing** provides optimal extraction from mixed content
- **Scoring system** efficiently resolves ambiguous union types

**Enhancement Focus**: Add discriminator fast-path to reduce union resolution overhead for the common case of discriminated unions while maintaining all existing performance optimizations.

## Migration Notes

**Backward Compatibility**: All enhancements maintain full backward compatibility with existing union processing. Generic unions continue to work exactly as before, with discriminated unions gaining fast-path optimization when discriminator fields are detected.

**Existing Features**: The excellent streaming, partial parsing, mixed content extraction, and complex schema support remain unchanged and continue to work seamlessly with enhanced discriminated union processing.

## References

* Original requirements: `specifications/03-advanced-object-parsing/feature.md`
* Rust architecture research: `specifications/03-advanced-object-parsing/research_2025-07-23_22-46-43_rust-advanced-object-parsing-architecture.md`
* Current union coercer: `src/deserializer/coercer/union_coercer.ts:14-51`
* Streaming implementation: `src/jsonish/value.ts:29-33` and `src/jsonish/parser/fixing-parser/json-parse-state.ts:288-504`
* Mixed content extraction: `src/jsonish/parser/markdown-parser.ts:54-133` and `src/jsonish/parser/multi-json-parser.ts:15-89`
* Test specification: `test/class-2.test.ts` (50+ comprehensive test cases exceed 11+ requirement)