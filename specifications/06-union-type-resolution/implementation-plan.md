---
date: 2025-08-26T18:45:00-05:00
researcher: Claude
git_commit: 1e3f518b3110c0d49947a983a1c4988c25cef173
branch: master
repository: jsonish
topic: "Union Type Resolution Implementation Strategy"
tags: [implementation, strategy, union, discriminated-union, parser, deserializer, coercer, scoring, zod]
status: updated_with_research_insights
last_updated: 2025-08-26
last_updated_by: Claude
type: implementation_strategy
---

# Union Type Resolution Implementation Strategy

## Overview

We're implementing sophisticated union type resolution for the JSONish parser to match the Rust BAML implementation. This includes intelligent type selection using scoring algorithms, discriminated union optimization, validation-based type selection, and graceful error handling. The current TypeScript implementation has basic union support with **5 of 17 tests failing (71% success rate)** but lacks the advanced scoring system, markdown extraction integration, and sophisticated selection heuristics needed for robust real-world usage.

## Current State Analysis

### What's Working ✅
- **Basic union resolution** in `jsonish/src/parser.ts:823-845` with simple scoring
- **Discriminated union fast-path** optimization using discriminator fields  
- **12/17 union tests passing** including object vs object, primitive unions, and validation-based selection
- **Zod integration** via `z.union` and `z.discriminatedUnion` schemas
- **Simple scoring algorithm** in `calculateUnionScore()` (lines 1027-1083) with type-based bonuses
- **Multi-strategy parser integration** available but not leveraged by union resolution

### Key Issues ❌ (5/17 tests failing)
- **Critical markdown extraction failures** - JSON in ```json blocks not extracted before union resolution (tests 3 & 4 failing)
- **Quote handling inconsistency** - String `"hello"` returns `"hello"` instead of `hello` in union context
- **Array type resolution errors** - Numbers `[1,2,3]` parsed as strings `["1","2","3"]` in string[]|number[] unions
- **Error handling issues** - Throwing exceptions instead of graceful fallback for unmatchable unions
- **Missing sophisticated scoring** - No flag-based penalties (1-110 points) or weighted scoring system from Rust
- **No advanced heuristics** - Missing `pick_best` algorithm with preference logic for composite over primitive types

### Critical Research Insights

#### **Rust Implementation Architecture** (`baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_union.rs`)
The Rust implementation uses a **sophisticated three-phase approach**:

1. **`try_cast_union`** (lines 8-67) - Conservative exact matching without coercion
2. **`coerce_union`** (lines 69-94) - Aggressive type conversion with comprehensive scoring
3. **`pick_best`** (`array_helper.rs:26-287`) - Advanced selection heuristics with preference rules

#### **Sophisticated Scoring System** (`score.rs:34-76`)
- **"Lower is better"** scoring (opposite of current TypeScript implementation)
- **Weighted flag penalties**:
  - `OptionalDefaultFromNoValue`: 1 point (mild penalty)
  - `ImpliedKey`: 2 points (inferred field penalty)  
  - `ObjectFromMarkdown`: Variable penalty based on extraction complexity
  - `DefaultFromNoValue`: 100 points (heavy penalty)
  - `DefaultButHadValue`: 110 points (heaviest penalty)
- **10x multiplier** for complex types (objects/arrays) applied to child element scores
- **Composite type preferences**: Real content over default-filled objects

#### **Advanced Selection Heuristics** (`array_helper.rs:26-287`)
- **List preferences**: Real arrays over single-to-array conversions
- **Type conversion penalties**: Composite types preferred over converted primitives  
- **Union-specific logic**: De-prioritizes single-field string coercions in union contexts
- **Markdown handling**: Prefers parsed JSON content over markdown strings

#### **Critical Missing Test Coverage** (Research findings)
- **30+ literal union test cases** from `test_literals.rs` not ported to TypeScript
- **Constraint-based union resolution** using Zod refinements (`.refine()`) - completely missing
- **International character support** - Multi-language literal unions not tested
- **Streaming/partial union tests** - Minimal coverage compared to Rust implementation
- **Performance benchmarks** - No union-specific performance testing infrastructure

## What We're NOT Doing

- Not implementing BAML-specific language features or DSL functionality
- Not changing the existing multi-strategy parser architecture  
- Not modifying the core Zod schema integration patterns
- Not implementing literal union support (separate feature)
- Not adding streaming union support in this phase (partial parsing)

## Implementation Approach

We'll implement union resolution as a **dedicated coercer** with sophisticated scoring, integrated with the existing parser pipeline. The approach follows the Rust two-phase pattern adapted for TypeScript/Zod, focusing on getting all current union tests to pass before adding advanced features.

## Phase 1: Fix Critical Union Resolution Issues

### Overview
Fix the **5 critical test failures** by integrating markdown extraction with union resolution, standardizing quote handling, correcting array type resolution, and implementing graceful error handling. Priority focus on the markdown extraction failures that are blocking complex discriminated union tests.

### Changes Required

#### 1. Content Extraction Integration  
**File**: `jsonish/src/parser.ts`  
**Changes**: Integrate markdown/code block extraction with union resolution

```typescript
// In coerceUnion function (lines 823-845)
function coerceUnion<T extends z.ZodUnion<any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  // FIRST: Apply content extraction if value contains markdown
  let processedValue = value;
  if (value.type === 'string' && value.value.includes('```json')) {
    // Try Strategy 2 extraction before union resolution
    const extracted = tryExtractEmbeddedJson(value.value);
    if (extracted) {
      processedValue = extracted;
    }
  }
  
  // THEN: Continue with existing union resolution logic
  const options = schema._def.options;
  // ... rest of current implementation
}
```

#### 2. Quote Handling Standardization
**File**: `jsonish/src/parser.ts`  
**Changes**: Fix inconsistent JSON parsing for quoted strings in unions

```typescript
// In calculateUnionScore function (lines 1027-1083) 
// Add special handling for string schemas with quoted content
if (option instanceof z.ZodString && value.type === 'string') {
  // If the string value looks like JSON-quoted content, test both forms
  const rawString = value.value;
  const unquotedString = rawString.startsWith('"') && rawString.endsWith('"') 
    ? rawString.slice(1, -1) 
    : rawString;
    
  // Test both quoted and unquoted forms against string schema
  // Choose the form that validates better
}
```

#### 3. Array Type Resolution Fix
**File**: `jsonish/src/parser.ts`  
**Changes**: Improve array union scoring to correctly distinguish element types (fixes number array vs string array confusion)

```typescript
// Enhanced scoring for array unions in calculateUnionScore
if (option instanceof z.ZodArray && value.type === 'array') {
  // Score based on how well array elements match the expected element type
  const elementSchema = option._def.type;
  let totalScore = 100; // Base array match score
  
  for (const element of value.elements) {
    try {
      const elementResult = coerceValue(element, elementSchema, ctx);
      const elementScore = calculateUnionScore(element, elementSchema, elementResult);
      totalScore += elementScore;
    } catch {
      totalScore -= 50; // Penalty for non-matching elements
    }
  }
  
  return totalScore;
}
```

#### 4. Graceful Error Handling for Unmatchable Unions
**File**: `jsonish/src/parser.ts`  
**Changes**: Add graceful fallback when no union option matches instead of throwing

```typescript
// In coerceUnion function - add fallback logic after trying all options
function coerceUnion<T extends z.ZodUnion<any>>(value: Value, schema: T, ctx: ParsingContext): z.infer<T> {
  // ... existing option testing logic ...
  
  // If no options scored well, try fallback strategies before throwing
  if (bestScore < acceptableThreshold) {
    // Strategy 1: Try string fallback if input is complex
    if (value.type === 'object' || value.type === 'array') {
      for (const option of options) {
        if (option instanceof z.ZodString) {
          try {
            return JSON.stringify(coerceValueGeneric(value)) as z.infer<T>;
          } catch { /* continue to next fallback */ }
        }
      }
    }
    
    // Strategy 2: Return best partial match if available
    if (bestResult) {
      return bestResult;
    }
  }
  
  // Only throw after all fallback strategies fail
  throw new Error(`No union member could handle input: ${JSON.stringify(coerceValueGeneric(value))}`);
}
```

### Success Criteria

**Automated Verification**
- [ ] `bun test ./test/unions.test.ts` passes all 17 test cases
- [ ] `bun test` passes full test suite with no regressions  
- [ ] `bun build` completes without TypeScript errors

**Manual Verification**  
- [ ] **Markdown extraction**: Discriminated union test passes (currently failing - JSON in ```json blocks)
- [ ] **Complex API response**: Large JSON in markdown resolves correctly (currently failing) 
- [ ] **Quote handling**: String `"hello"` returns `hello` not `"hello"` in unions (currently failing)
- [ ] **Array type resolution**: `[1,2,3]` returns `[1,2,3]` not `["1","2","3"]` in number[]|string[] unions (currently failing)
- [ ] **Error handling**: Unmatchable unions handled gracefully without throwing (currently failing)

## Phase 2: Implement Sophisticated Scoring System

### Overview
Replace the simple scoring algorithm with a comprehensive flag-based scoring system that matches the Rust implementation's sophistication. **Critical change**: Switch from "higher is better" (current TypeScript) to "lower is better" (Rust) scoring to match the sophisticated penalty-based system.

### Changes Required

#### 1. Flag/Condition Tracking System
**File**: `jsonish/src/value.ts`  
**Changes**: Extend Value type to track parsing metadata

```typescript
// Add flag tracking to Value type
export interface CoercionFlag {
  type: 'default_from_no_value' | 'optional_default' | 'object_from_markdown' | 
        'implied_key' | 'union_match' | 'single_to_array';
  penalty: number;
  context?: string;
}

export interface ValueWithFlags {
  value: any;
  flags: CoercionFlag[];
  score: number;
}

// Update Value interface to optionally carry flags
export interface Value {
  type: ValueType;
  value: any;
  // ... existing properties
  flags?: CoercionFlag[]; // Optional for backward compatibility
}
```

#### 2. Advanced Scoring Algorithm  
**File**: `jsonish/src/parser.ts`  
**Changes**: Replace calculateUnionScore with flag-based scoring

```typescript
// New scoring function matching Rust behavior
function calculateAdvancedUnionScore(
  value: Value, 
  schema: z.ZodType, 
  result: any, 
  coercionFlags: CoercionFlag[]
): number {
  let score = 0; // Start with perfect score (lower is better)
  
  // Base type compatibility score
  if (isExactMatch(value, schema)) {
    score += 0; // Perfect match
  } else if (isCoercible(value, schema)) {
    score += 1; // Minor coercion needed
  } else {
    score += 50; // Significant conversion required
  }
  
  // Apply flag-based penalties (matching Rust values)
  for (const flag of coercionFlags) {
    switch (flag.type) {
      case 'optional_default': score += 1; break;
      case 'default_from_no_value': score += 100; break;
      case 'object_from_markdown': score += flag.penalty || 5; break;
      case 'implied_key': score += 2; break;
      case 'union_match': score += 0; break; // No penalty for union selection
      case 'single_to_array': score += 10; break;
    }
  }
  
  // For complex types, multiply child scores by 10 (matching Rust)
  if (schema instanceof z.ZodObject || schema instanceof z.ZodArray) {
    score *= 10;
  }
  
  return score;
}
```

#### 3. Advanced Selection Heuristics
**File**: `jsonish/src/parser.ts`  
**Changes**: Implement pick_best algorithm with preference rules

```typescript
// Port Rust pick_best logic with TypeScript adaptations
function selectBestUnionMatch(results: Array<{result: any, schema: z.ZodType, score: number, flags: CoercionFlag[]}>): any {
  if (results.length === 0) {
    throw new Error('No union options matched');
  }
  
  if (results.length === 1) {
    return results[0].result;
  }
  
  // Sort by score (lower is better)
  results.sort((a, b) => a.score - b.score);
  
  // If scores are tied, apply preference heuristics
  const bestScore = results[0].score;
  const tiedResults = results.filter(r => r.score === bestScore);
  
  if (tiedResults.length === 1) {
    return tiedResults[0].result;
  }
  
  // Apply tie-breaking rules (port from Rust pick_best)
  // 1. Prefer composite types over primitive conversions from objects
  // 2. Prefer non-default values over defaults  
  // 3. Prefer markdown-free content over markdown strings
  // 4. For arrays: prefer real arrays over single-to-array conversions
  
  return applyPreferenceHeuristics(tiedResults)[0].result;
}
```

### Success Criteria

**Automated Verification**
- [ ] `bun test ./test/unions.test.ts` passes with improved scoring
- [ ] Complex union scenarios resolve correctly with advanced heuristics
- [ ] Performance benchmarks show reasonable execution time for complex unions

**Manual Verification**
- [ ] Union selection matches Rust implementation behavior for equivalent inputs
- [ ] Scoring system provides consistent, predictable results across similar scenarios
- [ ] Advanced heuristics properly prioritize composite over primitive types

## Phase 3: Optimization and Polish

### Overview  
Add performance optimizations, comprehensive error handling, and ensure full compatibility with existing JSONish capabilities.

### Changes Required

#### 1. Discriminated Union Fast-Path Optimization
**File**: `jsonish/src/parser.ts`
**Changes**: Optimize discriminated union resolution using discriminator field detection

```typescript
function coerceDiscriminatedUnion<T extends z.ZodDiscriminatedUnion<any, any>>(
  value: Value, schema: T, ctx: ParsingContext
): z.infer<T> {
  // Extract discriminator field from schema definition
  const discriminator = schema._def.discriminator;
  const optionsMap = schema._def.options;
  
  // Fast path: check discriminator field directly
  if (value.type === 'object') {
    const discriminatorValue = getDiscriminatorValue(value, discriminator);
    if (discriminatorValue !== undefined) {
      const matchingOption = optionsMap.get(discriminatorValue);
      if (matchingOption) {
        try {
          return coerceValue(value, matchingOption, ctx) as z.infer<T>;
        } catch (error) {
          // Fall through to full union resolution with better error context
        }
      }
    }
  }
  
  // Fallback to full union resolution if fast-path fails
  return coerceUnionWithScoring(value, Array.from(optionsMap.values()), ctx);
}
```

#### 2. Comprehensive Error Handling
**File**: `jsonish/src/parser.ts`  
**Changes**: Add graceful error recovery and detailed error reporting

```typescript
function coerceUnionWithGracefulFallback<T extends z.ZodUnion<any>>(
  value: Value, schema: T, ctx: ParsingContext
): z.infer<T> {
  try {
    return coerceUnionWithScoring(value, schema, ctx);
  } catch (error) {
    // Collect all attempted coercions for debugging
    const attempts = collectUnionAttempts(value, schema, ctx);
    
    // Try fallback strategies:
    // 1. String fallback if input is complex
    // 2. Best partial match if available
    // 3. Default value if schema allows
    
    const fallbackResult = attemptUnionFallback(value, schema, attempts);
    if (fallbackResult) {
      return fallbackResult;
    }
    
    // If all fallbacks fail, throw enhanced error with context
    throw new UnionResolutionError(
      `No union member matched input: ${JSON.stringify(coerceValueGeneric(value))}`,
      { attempts, originalError: error }
    );
  }
}
```

#### 3. Integration with Existing Features
**File**: `jsonish/src/parser.ts`
**Changes**: Ensure union resolution works with streaming, partials, and mixed content

```typescript
// Ensure union resolution integrates with all parsing strategies
function integrateUnionWithStrategies(input: string, schema: z.ZodUnion<any>): any {
  // Strategy 1: Try standard JSON parse first
  const strategy1Result = tryStrategy1(input);
  if (strategy1Result.success) {
    return coerceUnion(strategy1Result.value, schema, defaultContext);
  }
  
  // Strategy 2: Try mixed content extraction with union resolution
  const strategy2Result = tryStrategy2WithUnion(input, schema);
  if (strategy2Result.success) {
    return strategy2Result.value;
  }
  
  // Continue through remaining strategies...
  // Each strategy should be union-aware for optimal results
}
```

### Success Criteria

**Automated Verification**
- [ ] `bun test` passes completely with no test regressions
- [ ] `bun build` completes successfully
- [ ] Performance tests show acceptable union resolution speed

**Manual Verification**
- [ ] Discriminated unions resolve quickly using fast-path optimization  
- [ ] Error handling provides helpful debugging information for failed union resolutions
- [ ] Union resolution integrates seamlessly with streaming and partial parsing
- [ ] Complex real-world union scenarios work correctly

## Test Strategy

### Unit Tests
- [ ] **Core union resolution** - Test scoring algorithm with various input types
- [ ] **Discriminated union optimization** - Verify fast-path performance and fallback behavior
- [ ] **Flag-based scoring** - Test penalty system with different coercion scenarios
- [ ] **Selection heuristics** - Verify preference rules for tied scores

### Integration Tests  
- [ ] **Mixed content unions** - JSON in markdown with union resolution
- [ ] **Complex nested unions** - Multi-level union structures
- [ ] **Validation-based selection** - Regex/format validation driving union choice
- [ ] **Error recovery** - Graceful handling of unmatchable union inputs

### Regression Tests
- [ ] **Existing functionality** - Ensure union changes don't break non-union parsing
- [ ] **Performance benchmarks** - Union resolution doesn't significantly slow parsing
- [ ] **Memory usage** - Flag tracking doesn't cause excessive memory consumption

## Performance Considerations

### Expected Performance Impact
- **Discriminated unions**: Faster due to fast-path optimization
- **Complex unions**: Slightly slower due to comprehensive scoring, but more accurate
- **Memory overhead**: Minimal increase from flag tracking (5-10% for complex unions)

### Optimization Strategies
- **Early exit**: Stop testing union options when perfect match found (score = 0)
- **Discriminator detection**: Fast-path for discriminated unions
- **Lazy evaluation**: Only compute expensive scores when needed for tie-breaking
- **Result caching**: Cache union resolution results where beneficial

## Migration Notes

### Backward Compatibility
- Existing union parsing behavior maintained for simple cases
- Enhanced error messages may change for failed unions (improvement)
- Performance characteristics may change (mostly improvements)
- API remains the same - all changes are internal to parsing logic

### Breaking Changes
None expected - this is an enhancement to existing functionality

## References
* Original requirements: `specifications/06-union-type-resolution/feature.md`
* Related research: `specifications/06-union-type-resolution/research/research_2025-08-26_12-33-38_union-type-resolution-analysis.md`
* Rust reference implementation: `baml/engine/baml-lib/jsonish/src/deserializer/coercer/coerce_union.rs`
* Current TypeScript implementation: `jsonish/src/parser.ts:823-845`
* Union test cases: `test/unions.test.ts`
* Scoring system reference: `baml/engine/baml-lib/jsonish/src/deserializer/score.rs`
* Selection algorithm reference: `baml/engine/baml-lib/jsonish/src/deserializer/coercer/array_helper.rs:26-287`