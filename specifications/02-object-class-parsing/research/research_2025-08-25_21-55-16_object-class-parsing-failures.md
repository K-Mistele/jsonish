---
date: 2025-08-25T21:55:16-05:00
researcher: Claude Code
git_commit: fc4b81b08631ef025eba95de56d1472175dac6f3
branch: master
repository: jsonish
topic: "Object class parsing test failures analysis for 02-object-class-parsing"
tags: [research, codebase, object-parsing, discriminated-unions, field-mapping, union-resolution, class-parsing, type-coercion]
status: complete
last_updated: 2025-08-25
last_updated_by: Claude Code
type: research
---

# Research: Object Class Parsing Test Failures Analysis

**Date**: 2025-08-25T21:55:16-05:00  
**Researcher**: Claude Code  
**Git Commit**: fc4b81b08631ef025eba95de56d1472175dac6f3  
**Branch**: master  
**Repository**: jsonish

## Research Question

Please dig into the failing tests for 02-object-class-parsing and understand why they are failing, based on the original rust implementation and the current typescript implementation, and create a report on why they are failing and how it could be fixed.

## Summary

The failing tests for 02-object-class-parsing reveal a critical gap in the TypeScript implementation: **missing semantic field mapping support**. The core issue is that discriminated union parsing fails because the TypeScript parser cannot map `function_signature` (from input JSON) to `signature` (in the schema). This is not a formatting variation (like kebab-case vs snake_case) but a semantic alias that requires explicit mapping support.

The Rust implementation supports this through BAML `@alias` attributes (e.g., `signature string @alias("function_signature")`), but the TypeScript implementation lacks this semantic mapping capability, causing 8 out of 11 tests to fail.

## Detailed Findings

### Root Cause Analysis

#### 1. **Missing Semantic Field Mapping**
- **Location**: `jsonish/src/parser.ts:211-244` - `findAliasMatch()` function
- **Issue**: Current alias matching only handles formatting variations (kebab-case, snake_case, etc.) but cannot map semantic aliases like `function_signature` → `signature`
- **Impact**: Discriminated union resolution completely fails for objects with semantic field aliases

#### 2. **Discriminated Union Resolution Failures**
- **Location**: `jsonish/src/parser.ts:384-404` - `coerceUnion()` function  
- **Issue**: Union matching fails when field names require semantic mapping
- **Flow**: Input → JSON parse → Union coercion → Field matching → **FAIL** → Error thrown
- **Missing**: No union scoring system or fallback strategies (TODO comment indicates this is planned)

#### 3. **Limited JSON Fixing for Complex Content**
- **Location**: `jsonish/src/fixing-parser.ts` and `jsonish/src/extractors.ts:193-232`
- **Issue**: Cannot handle complex TypeScript function signatures in JSON values
- **Example**: `async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>`
- **Impact**: Markdown-embedded JSON arrays with function signatures become unparseable

#### 4. **Partial Parsing Logic Gaps**  
- **Location**: Parsing flow when `allowPartial: true`
- **Issue**: Returns string values instead of attempting object coercion for malformed JSON
- **Impact**: Zod validation fails with "expected object, received string" errors

### Specific Test Failure Analysis

#### Test 1-2: "should parse array with single/mixed server action(s)"
```
Error: No union option matched value
```
**Cause**: Input JSON uses `function_signature`, schema expects `signature`
**Fix**: Add semantic alias mapping `function_signature` → `signature`

#### Test 3-4: "should parse array with all three/four task types"  
```
Expected: [server_action, component, page] objects
Actual: [page] object only  
```
**Cause**: First two objects fail field mapping, only the third succeeds
**Fix**: Same semantic alias mapping + better union error recovery

#### Test 5: "should parse complex markdown with embedded JSON"
```
Expected: 16 objects parsed
Actual: 1 object parsed
```  
**Cause**: Complex function signatures break JSON fixing logic
**Fix**: Enhance JSON extraction to handle TypeScript syntax in string values

#### Tests 6-8: Partial parsing with incomplete arrays
```
ZodError: Invalid input: expected object, received string
```
**Cause**: Partial parsing returns string instead of attempting object coercion
**Fix**: Improve partial parsing to attempt object construction even for malformed input

### Architecture Comparison: Rust vs TypeScript

#### Rust Implementation Strengths
1. **BAML Schema Integration**: Direct access to `@alias` attributes
2. **Two-Phase Coercion**: `try_cast()` for strict matching, `coerce()` for flexible fallbacks  
3. **Sophisticated Scoring**: Integer-based penalty system for union resolution
4. **Field Mapping Strategies**: Direct → trimmed → case-insensitive → semantic alias
5. **Comprehensive Flag Tracking**: Metadata for all transformations applied

#### TypeScript Implementation Gaps
1. **No Semantic Alias Support**: Only handles formatting variations
2. **Single-Phase Coercion**: No distinction between strict vs flexible matching
3. **No Union Scoring System**: First successful match wins, no optimization
4. **Limited Field Matching**: Missing semantic alias layer
5. **Minimal Transformation Tracking**: No comprehensive metadata system

### Parser Flow Analysis

#### Current TypeScript Flow (Failing)
```
Input JSON → parseBasic() → coerceArray() → coerceValue(union) → coerceUnion() 
                                                                        ↓
coerceObject(ServerActionTaskSchema) → findBestFieldMatch("function_signature", "signature")
                                                                        ↓
findAliasMatch() → [functionsignature, function_signature, function-signature] 
                                                                        ↓
NO MATCH with "signature" → FIELD MATCH FAILS → UNION OPTION FAILS → ERROR
```

#### Required Flow (Working)  
```
Input JSON → parseBasic() → coerceArray() → coerceValue(union) → coerceUnion()
                                                                        ↓
coerceObject(ServerActionTaskSchema) → findBestFieldMatch("function_signature", "signature")
                                                                        ↓  
findAliasMatch() + SEMANTIC_ALIASES → ["signature"] matches! → SUCCESS
```

## Code References

- `test/class-2.test.ts:83` - Discriminated union test with `function_signature` field
- `jsonish/src/parser.ts:211-244` - Current alias matching implementation  
- `jsonish/src/parser.ts:384-404` - Union coercion logic with TODO for scoring system
- `jsonish/src/parser.ts:183-210` - Field matching strategies
- `jsonish/src/extractors.ts:193-232` - JSON extraction from mixed content
- `jsonish/src/state-machine.ts:338-382` - Advanced malformed JSON handling
- `baml/engine/baml-lib/jsonish/src/tests/test_class_2.rs` - Original Rust test with `@alias` attributes

## Architecture Insights

### Key Patterns Discovered
1. **Multi-Strategy Parsing**: TypeScript implementation uses 6 sequential parsing strategies
2. **State Machine Recovery**: Advanced malformed JSON handling for streaming/partial content  
3. **Field Matching Hierarchy**: Exact → trimmed → case-insensitive → alias (missing semantic layer)
4. **Union Resolution Gap**: No scoring system for optimal union member selection
5. **Metadata Tracking**: Limited transformation tracking compared to Rust flags system

### Semantic Alias Requirements  
Based on the failing tests, these semantic mappings are needed:
- `function_signature` ↔ `signature`
- `props` (object) ↔ `props` (string) - Type coercion handling
- Other domain-specific aliases for LLM output compatibility

## Recommendations for Fixes

### 1. **Immediate Fix - Add Semantic Alias Map**
```typescript
const SEMANTIC_ALIASES: Record<string, string[]> = {
  'signature': ['function_signature', 'func_signature', 'method_signature'],
  'description': ['desc', 'details', 'summary'],
  'properties': ['props', 'attributes', 'fields'],
};
```

### 2. **Enhance findAliasMatch() Function**
- Add semantic alias lookup as highest priority (confidence: 0.95)
- Maintain existing format-based alias matching (confidence: 0.7)
- Implement bidirectional alias mapping

### 3. **Add Union Scoring System** 
- Implement integer-based scoring (lower = better) like Rust implementation
- Score based on field match quality, discriminator presence, type coercion complexity
- Select best union option rather than first successful option

### 4. **Improve JSON Extraction for Complex Content**
- Enhance regex patterns to handle TypeScript function signatures
- Add bracket balancing for complex nested structures  
- Improve multiline string handling in JSON values

### 5. **Fix Partial Parsing Object Coercion**
- Ensure partial parsing attempts object construction even for malformed input
- Add proper null handling for incomplete/missing fields
- Implement completion state tracking for streaming scenarios

### 6. **Add ZodDiscriminatedUnion Support**
- Detect discriminated union schemas and implement fast-path discriminator checking
- Optimize union resolution for discriminated patterns
- Add discriminator field validation before attempting full object coercion

## Related Documentation

- `specifications/02-object-class-parsing/feature.md` - Feature requirements for object parsing
- `specifications/06-union-type-resolution/feature.md` - Union resolution architecture
- `specifications/09-alias-type-system/feature.md` - Alias type system implementation
- `baml/engine/baml-lib/jsonish/src/deserializer/coerce_class.rs` - Rust class coercion reference

## Related Research

- `research_2025-08-25_19-27-54_object-class-parsing-preparation.md` - Initial object parsing preparation
- `research_2025-08-26_01-53-54_rust-implementation-analysis.md` - Comprehensive Rust implementation analysis
- `research_2025-07-23_23-21-13_rust-union-type-resolution-architecture.md` - Union resolution patterns

## Open Questions

1. Should semantic aliases be configurable or hardcoded?
2. How to handle conflicting semantic aliases (multiple mappings to same field)?
3. What confidence scores should semantic aliases receive vs format-based aliases?
4. Should discriminated union optimization be implemented as a separate fast-path?
5. How to maintain backward compatibility when adding semantic alias support?

## Implementation Priority

1. **High Priority**: Semantic alias mapping for `function_signature` → `signature`
2. **High Priority**: Enhanced JSON extraction for complex function signatures  
3. **Medium Priority**: Union scoring system implementation
4. **Medium Priority**: Partial parsing object coercion fixes
5. **Low Priority**: ZodDiscriminatedUnion optimization support

The most critical fix is adding semantic field mapping support, which would resolve 5 out of 8 failing tests immediately.