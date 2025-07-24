# Feature: Alias Type System

## Overview
This feature implements comprehensive support for type aliases and recursive type definitions in the JSONish parser. It enables the definition and resolution of complex type relationships including simple aliases, recursive data structures (lists, maps), mutually recursive types, and sophisticated type cycles. The system leverages Zod's lazy evaluation capabilities to handle forward references and circular dependencies while maintaining type safety and performance optimization through intelligent alias resolution strategies.

## Relationship to Parent Requirements
This feature implements several key sections from `specifications/requirements.md`:

- **Schema Integration** (Section 4.1.2): Type coercion system with alias support and Zod schema integration
- **Advanced Features** (Section 4.1.4): Recursive parsing for deeply nested structures and circular references
- **Type Resolution Logic** (Section 5.3): Schema-first approach with complex type matching and union integration
- **Architecture & Module Structure** (Section 5.1): Coercer system handling type-specific conversions including alias coercion
- **Error Recovery Strategy** (Section 5.2): Context preservation during alias resolution and fallback mechanisms
- **Performance** (Section 4.2.1): Memory efficiency for recursive structures and parsing speed optimization

## Test-Driven Specifications
Based on test file: `test/aliases.test.ts`

### Core Capabilities Tested

#### Recursive Type Aliases
- **Simple Recursive Lists**: Type definitions like `type A = A[]` for nested array structures
- **Simple Recursive Maps**: Type definitions like `type A = map<string, A>` for nested object structures  
- **Recursive Types in Unions**: Integration of recursive aliases within union type schemas
- **Alias Cycle Resolution**: Complex cycles like `A = B, B = C, C = A[]` with proper dependency handling

#### JsonValue Type System
- **Universal JSON Type**: Comprehensive type representing all valid JSON values (primitives, arrays, objects)
- **Nested Structure Support**: Deep nesting of objects and arrays within JsonValue constraints
- **Mixed Type Collections**: Lists and objects containing heterogeneous JsonValue types
- **Real-world Data Modeling**: Complex structured data like recipes with mixed primitive and composite types

### Key Test Scenarios

1. **Simple Recursive List Parsing**: Handle infinitely nestable array structures
   - Input: `[[], [], [[]]]` 
   - Schema: `type RecursiveList = RecursiveList[]`
   - Output: Properly typed nested array structure

2. **Simple Recursive Map Parsing**: Handle infinitely nestable object structures
   - Input: `{"one": {"two": {}}, "three": {"four": {}}}`
   - Schema: `type RecursiveMap = map<string, RecursiveMap>`
   - Output: Properly typed nested object structure

3. **Recursive Types in Union Context**: Alias resolution within discriminated unions
   - Input: Recursive map data
   - Schema: `union[RecursiveMap, number]`
   - Expected: Correct type selection and parsing of recursive structure

4. **JsonValue Universal Parsing**: Handle any valid JSON structure dynamically
   - **Flat Objects**: `{"int": 1, "float": 1.0, "string": "test", "bool": true}`
   - **Nested Arrays**: `{"list": [1, 2, 3]}` within larger structures
   - **Nested Objects**: Multi-level object nesting with mixed types
   - **Deep Nesting**: Complex structures with arrays of objects containing more arrays/objects
   - **Array of Objects**: `[{...}, {...}]` with consistent object schemas

5. **Complex Real-World Data**: Recipe parsing with mixed primitives and collections
   - String values: recipe name, ingredient descriptions, instruction steps
   - Numeric values: serving counts, measurements
   - Array values: ingredient lists, instruction sequences
   - Nested structure: recipe object containing multiple typed fields

### Edge Cases Covered

- **Empty Recursive Structures**: `[]` for recursive lists, `{}` for recursive maps
- **Single-Level Nesting**: `[[42.1]]` - minimal recursive depth
- **Deep Nesting Limits**: Structures with many levels of recursion
- **Mixed Type Arrays**: Arrays containing different JsonValue types
- **Circular Reference Detection**: Preventing infinite loops during alias resolution
- **Performance with Large Structures**: Memory efficiency for deeply nested data
- **Type Disambiguation**: Resolving ambiguous cases where multiple alias types could match
- **Lazy Evaluation Errors**: Handling forward reference failures gracefully

### Expected Behavior

#### Alias Resolution Strategy
1. **Lazy Evaluation**: Use Zod's `z.lazy()` for forward references and circular dependencies
2. **Type Cache Management**: Cache resolved alias types to avoid redundant computation
3. **Recursive Depth Tracking**: Monitor recursion depth to prevent stack overflow
4. **Performance Optimization**: Minimize alias resolution overhead for frequently used types

#### Integration with Core Type System
1. **Union Type Support**: Aliases work seamlessly within union schemas
2. **Coercer Integration**: Alias coercer handles resolution to underlying concrete types
3. **Score System Compatibility**: Alias types participate in union scoring algorithms
4. **Validation Pipeline**: Full validation support for alias-resolved types

#### JsonValue System Behavior
1. **Dynamic Type Recognition**: Automatically identify appropriate JsonValue variant
2. **Structure Preservation**: Maintain original JSON structure while ensuring type safety
3. **Performance Optimization**: Efficient parsing of large JsonValue structures
4. **Error Propagation**: Clear error messages when JsonValue constraints are violated

## Implementation Requirements

### Alias Resolution Engine
- **Lazy Schema Evaluation**: Implement deferred type resolution using `z.lazy()`
- **Circular Reference Detection**: Track reference chains to prevent infinite loops
- **Type Cache System**: Cache resolved alias definitions for performance
- **Forward Reference Support**: Handle aliases that reference not-yet-defined types

### Recursive Structure Handling
- **Depth Monitoring**: Track recursion depth during parsing to prevent stack overflow
- **Memory Management**: Efficient handling of deeply nested recursive structures
- **Partial Resolution**: Support for incomplete recursive structures during streaming
- **Performance Optimization**: Minimize overhead for recursive type resolution

### JsonValue Implementation
- **Universal Type Definition**: Comprehensive JsonValue type covering all JSON possibilities
- **Dynamic Dispatch**: Efficient routing to appropriate type handlers based on input
- **Structure Validation**: Ensure parsed structures conform to JsonValue constraints
- **Type Safety**: Maintain TypeScript type safety while supporting dynamic content

### Integration Points
- **Coercer System**: Implement `alias_coercer.ts` for alias-specific type handling
- **Union Resolution**: Ensure aliases work properly within union type contexts  
- **Score System**: Provide appropriate scoring for alias type matching
- **Error Handling**: Clear error messages for alias resolution failures

## Success Criteria

### Immediate Goals
- All tests in `aliases.test.ts` pass (currently targeting 100% pass rate)  
- Recursive list aliases correctly parse nested array structures
- Recursive map aliases correctly parse nested object structures
- JsonValue system handles all primitive and composite JSON types

### Advanced Functionality
- **Recursive Types in Unions**: Aliases work seamlessly within discriminated unions
- **Complex Alias Cycles**: Multi-step alias chains resolve correctly
- **Performance Benchmarks**: Recursive parsing maintains acceptable performance
- **Memory Efficiency**: Large recursive structures don't cause memory issues

### Quality Standards
- **Type Safety**: Full TypeScript type checking for all alias operations
- **Error Recovery**: Graceful handling of invalid recursive structures
- **Integration Testing**: Aliases work with all other JSONish parser features
- **Documentation Coverage**: Clear examples of alias usage patterns

### Behavioral Requirements
- **Rust Parity**: Exact behavior matching with original Rust implementation
- **Zod Integration**: Seamless integration with Zod schema validation
- **Performance**: Comparable performance to non-alias types for simple cases
- **Scalability**: Handle deeply nested recursive structures without degradation