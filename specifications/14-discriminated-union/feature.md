---
date: 2025-07-24T12:00:00-08:00
author: Claude Code
git_commit: d53a90d
branch: master
repository: jsonish
topic: "Discriminated Union Support Requirements"
tags: [requirements, parser, discriminated-union, zod-integration, type-resolution]
status: complete
last_updated: 2025-07-24
type: requirements
---

# Feature: Discriminated Union Support

## Overview
This feature implements comprehensive discriminated union parsing capabilities for the JSONish parser, enabling intelligent type resolution based on discriminator keys defined in Zod schemas. It provides efficient union member selection using discriminator fields, supports nested discriminated unions, handles mixed content extraction for discriminated types, and integrates seamlessly with Zod's `z.discriminatedUnion()` API for performance optimization and enhanced type safety.

## Relationship to Parent Requirements
This feature implements several key sections from `specifications/requirements.md`:

- **Schema Integration** (Section 4.1.2): Zod discriminated union schema support with discriminator-based type resolution
- **Type Resolution Logic** (Section 5.3): Fast-path discriminator resolution with fallback to regular union logic
- **Advanced Features** (Section 4.1.4): Nested discriminated unions and complex discriminator patterns
- **Error Handling & Reliability** (Section 4.2.2): Graceful handling of missing discriminators and ambiguous cases
- **Core Parsing Engine** (Section 4.1.1): Integration with multi-strategy parser for discriminated union resolution

## Test-Driven Specifications
Based on test file: `test/class-2.test.ts` (Discriminated Unions section)

### Core Capabilities Tested

#### Basic Discriminated Union Parsing
- **Single Object Resolution**: Parsing individual objects with discriminator-based type selection
- **Array of Discriminated Objects**: Parsing arrays containing multiple discriminated union objects
- **Mixed Discriminator Types**: Handling arrays with different discriminated union members
- **Complex Discriminator Values**: Supporting various discriminator value types (strings, literals, enums)

#### Discriminator-Based Type Selection
- **Literal Discriminators**: Using `z.literal()` values as discriminator keys for type selection
- **Fast-Path Resolution**: Optimizing parsing by checking discriminator field first
- **Type Narrowing**: Ensuring proper TypeScript type narrowing based on discriminator values
- **Validation Integration**: Combining discriminator matching with full schema validation

#### Real-World Scenario Testing
- **Task Management System**: Complex discriminated unions for different task types (server_action, page, component)
- **API Response Patterns**: Success/error discriminated unions with different data structures
- **Form Validation**: Dynamic validation based on discriminator field values
- **Nested Object Support**: Discriminated unions within complex nested structures

### Key Test Scenarios

1. **Basic Task Type Discrimination**
   ```typescript
   // Input: {type: "page", name: "HomePage", description: "Landing page", ...}
   // Schema: z.discriminatedUnion("type", [ServerActionTaskSchema, PageTaskSchema, ComponentTaskSchema])
   // Expected: PageTaskSchema selected based on type="page" discriminator
   ```

2. **Array of Mixed Task Types**
   ```typescript
   // Input: [{type: "server_action", ...}, {type: "component", ...}]
   // Schema: z.array(TaskUnionSchema)
   // Expected: Each object resolved to appropriate discriminated union member
   ```

3. **Complex Nested Discriminated Objects**
   ```typescript
   // Input: Multi-level nested structure with discriminated unions at different levels
   // Schema: Discriminated union containing objects with nested discriminated unions
   // Expected: Correct resolution at all nesting levels
   ```

4. **Malformed JSON with Discriminators**
   ```typescript
   // Input: '{type: server_action, name: fetchPosts, description: Fetch posts}'  // Missing quotes
   // Schema: TaskUnionSchema with "type" discriminator
   // Expected: Successful parsing with type="server_action" discriminator resolution
   ```

5. **Mixed Content Extraction with Discriminators**
   ```typescript
   // Input: Markdown text containing JSON with discriminated union structure
   // Schema: Discriminated union schema
   // Expected: JSON extracted and correctly parsed with discriminator resolution
   ```

6. **Error Handling for Invalid Discriminators**
   ```typescript
   // Input: {type: "invalid_type", name: "test"}
   // Schema: TaskUnionSchema with known discriminator values
   // Expected: Graceful error handling or fallback to regular union resolution
   ```

### Advanced Discriminated Union Scenarios

#### Nested Discriminated Unions
- **Multi-Level Discrimination**: Discriminated unions containing objects with their own discriminated union fields
- **Recursive Structures**: Self-referencing discriminated unions with proper resolution
- **Cross-Schema References**: Discriminated unions referencing other discriminated union schemas

#### Performance Optimization Cases
- **Large Union Sets**: Discriminated unions with many member schemas (10+ options)
- **Deep Object Discrimination**: Discriminated unions with complex object structures
- **Array Processing**: Efficient processing of large arrays containing discriminated union objects

#### Edge Cases and Error Recovery
- **Missing Discriminator Field**: Handling objects missing the discriminator key
- **Ambiguous Discriminator Values**: Managing discriminator values that could match multiple schemas
- **Type Coercion with Discriminators**: Converting discriminator values to match schema expectations
- **Partial Object Parsing**: Discriminated union resolution with incomplete object data

### Expected Behavior

#### Discriminator Resolution Algorithm
1. **Discriminator Field Check**: Immediately examine the discriminator field value
2. **Schema Matching**: Find all union members that match the discriminator value
3. **Full Validation**: Validate complete object against matched schema(s)
4. **Best Match Selection**: Select best matching schema based on validation success
5. **Fallback Logic**: Fall back to regular union resolution if discriminator approach fails

#### Performance Optimization Strategy
1. **Fast-Path Resolution**: Skip full schema validation for non-matching discriminator values
2. **Discriminator Indexing**: Pre-index union members by discriminator values for O(1) lookup
3. **Early Exit**: Return immediately upon finding perfect discriminator + validation match
4. **Caching**: Cache discriminator-to-schema mappings for repeated parsing operations

#### Error Handling Approach
1. **Missing Discriminator Graceful**: Fall back to regular union resolution when discriminator missing
2. **Invalid Discriminator Values**: Provide clear error messages for unrecognized discriminator values
3. **Validation Failure Recovery**: Try alternative union members if discriminator match fails validation
4. **Type Coercion Integration**: Apply type coercion to discriminator values when appropriate

#### Content Processing Integration
1. **Mixed Content Extraction**: Extract JSON from text before applying discriminated union resolution
2. **Malformed JSON Fixing**: Apply error recovery before discriminator-based resolution
3. **Streaming Support**: Handle partial discriminated union data in streaming scenarios
4. **Array Processing**: Efficiently process arrays of discriminated union objects

## Implementation Requirements

### Core Discriminated Union Engine
- **Discriminated Union Coercer**: Specialized coercer implementation in `src/deserializer/coercer/discriminated_union_coercer.ts`
- **Discriminator Detection**: Logic to identify discriminator fields from Zod discriminated union schemas
- **Fast-Path Resolution**: Optimized resolution path for discriminator-based type selection
- **Fallback Integration**: Seamless fallback to regular union resolution when needed

### Zod Schema Integration
- **z.discriminatedUnion() Support**: Full support for Zod's discriminated union API
- **Discriminator Key Extraction**: Extract discriminator field names from schema definitions  
- **Union Member Mapping**: Map discriminator values to corresponding union member schemas
- **Type Safety Preservation**: Maintain TypeScript type safety and inference

### Performance Optimization System
- **Discriminator Indexing**: Pre-compute discriminator value to schema mappings
- **Early Validation Exit**: Skip unnecessary validation for non-matching discriminators
- **Memory Efficiency**: Minimize memory overhead for discriminator caching
- **Batch Processing**: Optimize for arrays containing many discriminated union objects

### Error Recovery and Validation
- **Missing Discriminator Handling**: Graceful degradation when discriminator field absent
- **Invalid Value Management**: Clear error reporting for unrecognized discriminator values
- **Validation Error Aggregation**: Collect and report validation errors from discriminated schemas
- **Type Coercion Integration**: Apply coercion to discriminator values when appropriate

## Success Criteria

### Core Functionality
- All tests in `class-2.test.ts` discriminated union section pass (currently 5+ test scenarios)
- Basic discriminated union resolution with literal discriminators works correctly
- Array processing of mixed discriminated union objects functions properly
- Complex nested discriminated union structures resolve accurately

### Performance Standards  
- Discriminated union resolution performs significantly faster than regular union resolution (target: 50%+ improvement)
- Large discriminated union sets (10+ members) resolve efficiently
- Array processing of discriminated union objects scales linearly
- Memory usage remains bounded for complex discriminated union schemas

### Integration Requirements
- Seamless integration with existing union coercer system
- Compatible with malformed JSON fixing parser for discriminated union content
- Proper integration with scoring system for ambiguous discriminator cases
- Streaming and partial parsing support for discriminated union data

### Error Handling Quality
- Missing discriminator fields handled gracefully without exceptions
- Invalid discriminator values produce clear, actionable error messages
- Validation failures provide detailed feedback for debugging
- Edge cases (empty objects, null discriminators) handled appropriately

### Behavioral Requirements
- Exact parity with Zod discriminated union behavior and type inference
- Consistent discriminator resolution across similar input scenarios
- Predictable fallback behavior when discriminator approach fails
- Full compatibility with existing JSONish parsing pipeline features

### Advanced Feature Support
- Nested discriminated unions resolve correctly at all levels
- Recursive discriminated union structures handle circular references safely
- Mixed content extraction works with discriminated union schemas
- Union member schemas can themselves contain other union types (regular or discriminated)

## API Design

### Core API Integration
```typescript
// Existing parser should automatically detect and handle discriminated unions
const TaskUnionSchema = z.discriminatedUnion("type", [
  ServerActionTaskSchema,
  PageTaskSchema, 
  ComponentTaskSchema,
]);

// No API changes needed - existing parse method should work
const result = parser.parse(input, TaskUnionSchema);
```

### Performance Monitoring
```typescript
// Optional: Performance monitoring for discriminated union resolution
interface DiscriminatedUnionStats {
  discriminatorHits: number;
  fallbackResolutions: number;
  averageResolutionTime: number;
}
```

### Error Information Enhancement
```typescript
// Enhanced error information for discriminated union failures
interface DiscriminatedUnionError extends ParseError {
  discriminatorField: string;
  discriminatorValue: unknown;
  availableDiscriminators: string[];
  validationErrors: ValidationError[];
}
```

## Test Coverage

### Test Categories
- Basic discriminated union parsing (literal discriminators)
- Array processing with mixed discriminated union members
- Complex nested discriminated union structures
- Performance benchmarks against regular union resolution
- Error handling for missing/invalid discriminators
- Mixed content extraction with discriminated unions
- Malformed JSON recovery with discriminated union schemas

### Edge Cases
- Empty discriminator values
- Null/undefined discriminator fields
- Discriminator type coercion scenarios
- Deeply nested discriminated structures
- Large union sets with many discriminator options
- Recursive discriminated union references

## Implementation Strategy

### Phase 1: Core Discriminated Union Support
1. Implement discriminated union coercer with basic discriminator detection
2. Add fast-path resolution for exact discriminator matches
3. Integrate with existing union resolution fallback logic
4. Ensure all basic test scenarios pass

### Phase 2: Performance Optimization
1. Implement discriminator value indexing for O(1) lookup
2. Add early validation exit optimization
3. Optimize array processing for discriminated union objects
4. Add performance monitoring and benchmarking

### Phase 3: Advanced Features and Edge Cases
1. Support nested discriminated unions
2. Implement comprehensive error handling and recovery
3. Add mixed content extraction integration
4. Handle recursive discriminated union scenarios

### Phase 4: Integration and Polish
1. Full integration testing with existing parser features
2. Performance tuning and memory optimization
3. Documentation and example updates
4. Final test coverage validation