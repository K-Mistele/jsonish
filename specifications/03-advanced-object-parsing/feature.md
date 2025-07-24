---
date: 2025-01-23T22:52:00-08:00
researcher: Claude Code
git_commit: 4e974c5db60f8c7dd723a17d38948bae5afc488f
branch: master
repository: jsonish
topic: "Advanced Object Parsing Capabilities"
tags: [advanced-parsing, discriminated-unions, streaming, partial-parsing, nested-objects, mixed-content]
status: complete
last_updated: 2025-01-23
last_updated_by: Claude Code
type: feature-specification
test_file: test/class-2.test.ts
---

# Feature Specification: Advanced Object Parsing

## Overview

This specification defines the advanced object parsing capabilities of the JSONish parser, extending beyond basic object deserialization to handle complex scenarios including discriminated unions, streaming data, partial parsing, and mixed content with embedded JSON structures.

## Test File Analysis

**Source**: `/Users/kyle/Documents/Projects/jsonish/test/class-2.test.ts`

The test file contains 236+ test cases organized into three main categories:
1. **Discriminated Unions** (6 tests)
2. **Streaming Classes** (2 tests) 
3. **Partial Parsing** (3 tests)

## Core Features

### 1. Discriminated Union Processing

#### Schema-Based Type Resolution
- **Discriminated Union Support**: Parse objects that use a discriminator field (e.g., `type`) to determine the specific schema
- **Multi-Type Schemas**: Handle unions of complex object types with different field structures
- **Type-Specific Validation**: Each union variant has its own validation rules and required fields

#### Real-World Use Cases
The test scenarios simulate a blog application architecture with three distinct entity types:
- **Server Actions**: Function definitions with signatures
- **Components**: UI components with props definitions  
- **Pages**: Route definitions with dependencies

#### Advanced Union Features
- **Mixed Array Processing**: Arrays containing different union types in the same structure
- **Large-Scale Processing**: Handle arrays with multiple instances of different union types (4+ items)
- **Complex Field Mapping**: Map inconsistent field names (e.g., `function_signature` → `signature`)

### 2. Mixed Content and Embedded JSON Extraction

#### Markdown Integration
- **Documentation Parsing**: Extract structured JSON data from markdown documentation
- **Context Preservation**: Parse JSON while preserving surrounding explanatory text
- **Multi-Format Support**: Handle JSON embedded within larger text documents

#### Complex Content Scenarios
- **Blog Planning Documents**: Real-world scenario with 400+ lines of mixed markdown and JSON
- **Multi-Section Documents**: Handle documents with multiple sections containing JSON
- **Structured Documentation**: Parse JSON from technical specifications and planning documents

#### JSON Extraction Capabilities
- **Pattern Recognition**: Identify JSON arrays within mixed content
- **Content Boundaries**: Properly delimit JSON from surrounding text
- **Format Tolerance**: Handle various JSON formatting styles within documents

### 3. Streaming and Partial Object Processing

#### Streaming Data Support
- **Incomplete Structures**: Parse JSON that is being received incrementally
- **Nested Object Streaming**: Handle complex nested objects with arrays during streaming
- **Large Object Handling**: Process objects with multiple nested classes and arrays

#### Partial Parsing Features
- **Incomplete Array Handling**: Parse arrays where items are partially received
- **Nullable Field Support**: Handle objects where some fields may be incomplete
- **State Preservation**: Maintain parsing state for incomplete structures

#### Complex Nested Structures
- **Multi-Level Nesting**: Objects containing other objects containing arrays
- **Mixed Data Types**: Handle combinations of strings, numbers, nested objects, and arrays
- **Schema Flexibility**: Support optional and nullable fields for partial data

### 4. Advanced Object Schema Features

#### Complex Object Structures
- **Semantic Containers**: Objects with meaningful business logic relationships
- **Deep Nesting**: Multiple levels of object and array nesting
- **Large Field Counts**: Objects with 8+ fields of varying types

#### Field Type Diversity
- **Numeric Precision**: Handle large numbers (16-digit integers)
- **String Constraints**: Manage strings with specific word count requirements
- **Array Relationships**: Objects containing arrays of other complex objects
- **Reference Handling**: Objects that reference other objects by name/ID

## Technical Implementation Requirements

### Schema Definition and Validation
- **Zod Integration**: Full integration with Zod discriminated union schemas
- **Type Safety**: Maintain TypeScript type safety for all union variants
- **Runtime Validation**: Proper validation of discriminator fields and variant-specific fields

### Error Handling and Recovery
- **Partial Structure Recovery**: Handle incomplete objects gracefully
- **Missing Field Handling**: Provide defaults or null values for missing fields
- **Invalid Discriminator Handling**: Handle cases where discriminator values don't match any variant

### Performance Considerations
- **Large Document Processing**: Efficiently process documents with 400+ lines of mixed content
- **Complex Object Parsing**: Handle deeply nested structures without performance degradation
- **Memory Management**: Manage memory efficiently during streaming scenarios

## Expected Behavior Patterns

### Union Type Resolution
```typescript
// Input with mixed types in array
[
  { type: "server_action", name: "fetchPosts", ... },
  { type: "component", name: "PostCard", ... },
  { type: "page", name: "HomePage", ... }
]

// Expected: Correctly identify and parse each type according to its schema
```

### Streaming Object Processing
```typescript
// Partial input during streaming
{
  "sixteen_digit_number": 1234567890123456,
  "string_with_twenty_words": "...",
  "class_1": { "i_16_digits": 123
  
// Expected: Parse complete fields, handle incomplete structures
```

### Mixed Content Extraction
```typescript
// Input: Markdown document with embedded JSON array
"Let me break this down page by page: ... [{ type: page, name: HomePage, ... }]"

// Expected: Extract and parse JSON while ignoring surrounding text
```

## Integration Points

### Parser System Integration
- **Entry Parser**: Coordinate between standard JSON parsing and advanced object processing
- **Fixing Parser**: Handle malformed JSON within complex object structures
- **Multi-Object Parser**: Process sequences of objects as arrays

### Deserializer System Integration
- **Union Coercer**: Implement intelligent type selection for discriminated unions
- **Object Coercer**: Handle complex nested object structures
- **Array Coercer**: Process arrays containing mixed union types

### Value System Integration
- **Complex Value Representation**: Support for nested object and array values
- **Partial Value States**: Handle incomplete values during streaming
- **Type Information Preservation**: Maintain type metadata for union resolution

## Success Criteria

### Functional Requirements
- **11 Tests Passing**: All test cases in class-2.test.ts must pass
- **Schema Compliance**: All parsed objects must validate against their respective Zod schemas
- **Type Accuracy**: Discriminated unions must resolve to correct variant types

### Performance Requirements
- **Large Document Handling**: Process 400+ line documents efficiently
- **Complex Structure Support**: Handle 8+ field objects with deep nesting
- **Memory Efficiency**: Manage memory during streaming scenarios

### Error Handling Requirements
- **Graceful Degradation**: Handle partial parsing scenarios without failures
- **Meaningful Errors**: Provide clear error messages for schema validation failures
- **Recovery Mechanisms**: Attempt to parse incomplete structures when possible

## Advanced Capabilities Summary

The class-2.test.ts file demonstrates the JSONish parser's advanced object processing capabilities:

1. **Discriminated Union Mastery**: Sophisticated type resolution for complex union schemas with real-world entity modeling
2. **Mixed Content Intelligence**: Advanced extraction of JSON from documentation and markdown with context awareness
3. **Streaming Robustness**: Robust handling of incomplete and partial data structures during real-time processing
4. **Complex Schema Support**: Support for deeply nested objects with diverse field types and relationships

These capabilities differentiate the JSONish parser from standard JSON parsing libraries by providing intelligent, schema-aware processing of complex, real-world data structures and mixed content scenarios.