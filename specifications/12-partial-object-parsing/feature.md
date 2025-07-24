# Feature: Partial Object Parsing

## Overview
This feature enables the JSONish parser to handle incomplete JSON structures, allowing parsing of partial objects, arrays, and complex nested data that may be truncated due to streaming scenarios, incomplete data transmission, or parsing interruption. The parser intelligently handles missing closing brackets, incomplete values, and partial data structures while maintaining type safety through schema validation and providing meaningful default values for missing fields.

## Relationship to Parent Requirements
This feature implements several key sections from `specifications/requirements.md`:

- **Advanced Features** (Section 4.1.4): Streaming support and partial completion tracking for real-time scenarios
- **Core Parsing Engine** (Section 4.1.1): Error recovery mechanisms for incomplete structures
- **Schema Integration** (Section 4.1.2): Type coercion system that handles nullable and optional fields
- **Error Recovery Strategy** (Section 5.2): Incremental fixes and context preservation for partial data
- **Type Resolution Logic** (Section 5.3): Schema-first approach with validation integration for incomplete objects

## Test-Driven Specifications
Based on test file: `test/partials.test.ts`

### Core Capabilities Tested

#### Complete vs Partial Data Handling
- **Complete Object Parsing**: Full object structures with all required fields populated
- **Partial Object Parsing**: Incomplete objects with missing or truncated fields that require `allowPartial: true` flag
- **Mixed Schema Support**: Objects with both required and nullable/optional fields
- **Default Value Generation**: Automatic population of missing fields with appropriate defaults (null, empty arrays, empty objects)

#### Streaming and Incomplete Data Scenarios
- **Truncated JSON Strings**: Input that ends mid-parsing (e.g., `{"name": "test", "value": 42, "items": ["one", "two"`)
- **Incomplete Nested Structures**: Objects with partially complete nested objects and arrays
- **Interrupted Parsing**: JSON that stops mid-field or mid-value definition
- **Progressive Parsing**: Building complete objects from incrementally received partial data

#### Complex Data Structure Recovery
- **Book Analysis Data**: Large nested objects with multiple arrays and complex relationships
- **Graph Data Structures**: Vertices and edges with metadata, handling incomplete vertex definitions
- **Resume/Profile Data**: Real-world document structures with optional fields and nested arrays
- **Multi-level Nesting**: Objects containing arrays of objects with their own nested structures

### Key Test Scenarios

1. **Complete Book Analysis Parsing**: Full complex object with nested arrays and relationships
   - Input: Complete JSON with book names, popularity data, rankings, and word counts
   - Expected: Proper field mapping (e.g., `popularityData` → `popularityOverTime`)
   - Schema coercion: Array structures maintained with proper type conversion

2. **Partial Book Analysis**: Incomplete data structure with truncated arrays
   - Input: JSON ending mid-array: `{"bookNames": [...], "popularityData": [{"bookName": "brave new world", "scores": [{"year": 1950, "score": 70},`
   - Expected: Complete `bookNames` array, partial `popularityOverTime` with one entry, empty arrays for missing fields
   - Flag requirement: `allowPartial: true`

3. **Partial Graph JSON with Null Handling**: Incomplete vertex definitions
   - Input: Graph with incomplete vertex: `{"vertices": [{"id": "stephanie_morales", "metadata": {...}}, {"id":`
   - Expected: Complete first vertex, second vertex with `id: null` and empty metadata
   - Schema handling: Nullable fields properly handled in partial schemas

4. **Union Type Resolution with Partials**: Complex union types containing partial graph schemas
   - Input: Same partial graph data with union schema `z.union([PartialGraphJsonSchema, z.array(PartialGraphJsonSchema), ErrorSchema])`
   - Expected: Correct resolution to `PartialGraphJsonSchema` despite incomplete data
   - Score-based selection: Parser selects best matching union member

5. **Simple Partial Object Recovery**: Basic incomplete object structures
   - Incomplete arrays: `{"items": ["one", "two", "three"`
   - Incomplete strings: `{"name": "test string that is not terminated`
   - Expected: Proper completion with missing brackets/quotes added

### Advanced Partial Parsing Scenarios

#### Resume Data with Partial Experience
- **Incomplete String Arrays**: Experience array with truncated final string
- **Missing Optional Fields**: Resume with only partial contact information
- **Progressive Field Population**: Starting with one field and expanding

#### Malformed JSON Recovery
- **Structural Errors**: JSON with syntax errors that prevent standard parsing
- **Multiple Object Sequences**: Malformed JSON containing multiple object definitions
- **Recovery Strategy**: Parser attempts to extract valid portions and complete structures

#### Nested Partial Objects
- **Multi-level Structures**: Objects with nested objects that are themselves incomplete
- **Array Element Completion**: Arrays containing partially complete objects
- **Mixed Completeness**: Some fields complete, others partial within same object

### Edge Cases Covered

- **Empty Partial Input**: JSON that starts but contains no complete values
- **Nested Array Incompleteness**: Arrays within objects that are not properly closed
- **String Termination Issues**: Strings that lack closing quotes in partial data
- **Metadata and Record Handling**: Partial objects with `z.record()` fields
- **Nullable Field Resolution**: Proper handling of `z.string().nullable()` in partial contexts
- **Mixed Required/Optional Fields**: Schemas with combination of required and optional properties

### Expected Behavior

#### Partial Parsing Rules
1. **Flag-Based Activation**: Partial parsing only enabled with `allowPartial: true` option
2. **Schema-Driven Defaults**: Missing fields populated based on schema definition (null for nullable, empty arrays/objects for collections)
3. **Best Effort Completion**: Parser attempts to complete incomplete structures (add missing brackets, quotes)
4. **Validation Compatibility**: Partial results still validate against target schema with appropriate nullable/optional modifications

#### Error Recovery for Partials
1. **Incremental Structure Building**: Build valid objects from whatever complete data is available
2. **Graceful Field Omission**: Skip incomplete fields rather than failing entire parse
3. **Context Preservation**: Maintain object structure even when individual fields are incomplete
4. **Type Safety**: Ensure partial objects still conform to expected TypeScript types

#### Union Type Resolution with Partials
1. **Scoring with Incomplete Data**: Modified scoring algorithm accounts for partial data completeness
2. **Schema Preference**: Prefer schemas that better accommodate partial data (e.g., nullable fields)
3. **Fallback Logic**: Multiple union candidates evaluated for best partial match

## Implementation Requirements

### Parser Architecture for Partials
- **Partial Flag Support**: `allowPartial` option enables incomplete structure handling
- **Completion State Tracking**: Internal tracking of which fields/structures are complete vs partial
- **Default Value Generation**: Automatic creation of appropriate defaults for missing schema fields
- **Bracket/Quote Completion**: Intelligent completion of incomplete JSON syntax

### Schema Integration for Partials
- **Nullable Field Handling**: Proper processing of `z.string().nullable()` and similar optional fields
- **Partial Schema Generation**: Ability to work with `.partial()` Zod schema modifiers
- **Default Population Strategy**: Schema-aware default value creation for missing fields
- **Validation Adaptation**: Modified validation that accounts for partial data completeness

### Streaming Compatibility
- **Progressive Parsing**: Support for building objects as more data becomes available
- **State Preservation**: Maintain parsing state across multiple partial inputs
- **Completion Detection**: Ability to determine when partial object becomes complete
- **Real-time Updates**: Support for updating partial objects with additional data

### Content Processing for Partials
- **Incomplete Structure Detection**: Identify when JSON structure is incomplete vs malformed
- **Recovery Prioritization**: Prefer completing existing structures over starting new ones
- **Context Analysis**: Use surrounding complete data to infer incomplete field types
- **Validation Integration**: Ensure partial results are still schema-compliant

## Success Criteria

### Core Functionality
- All tests in `partials.test.ts` pass (currently testing both Rust core tests and TypeScript extensions)
- Proper handling of complex nested structures like book analysis and graph data
- Correct field mapping and schema coercion for partial data
- Union type resolution works correctly with incomplete data

### Partial Parsing Accuracy
- **Flag Behavior**: Partial parsing only activates with `allowPartial: true`
- **Default Generation**: Missing fields populated with schema-appropriate defaults
- **Structure Completion**: Incomplete JSON syntax properly completed (brackets, quotes)
- **Type Safety**: Partial objects maintain TypeScript type safety

### Integration with Other Features
- **Union Resolution**: Partial data doesn't break union type selection logic
- **Error Recovery**: Partial parsing works alongside general malformed JSON recovery
- **Streaming Support**: Partial objects support progressive data addition
- **Schema Validation**: Partial results validate against modified schemas

### Real-world Scenarios
- **Document Processing**: Handle incomplete documents like resumes with missing sections
- **API Response Parsing**: Parse partial API responses during streaming scenarios
- **Form Data Processing**: Handle partially completed forms with optional fields
- **Data Migration**: Process incomplete data during migration with appropriate defaults

### Quality Standards
- 100% test coverage for all partial parsing scenarios in test file
- Graceful handling of all edge cases without exceptions
- Performance impact minimal compared to complete object parsing
- Clear error messages when partial parsing fails validation
- Behavioral parity with Rust implementation for all documented test cases