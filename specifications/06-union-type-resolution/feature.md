# Feature: Union Type Resolution

## Overview
This feature implements intelligent union type resolution capabilities for the JSONish parser, enabling automatic selection of the best matching type from union schemas based on input data structure, content analysis, and sophisticated scoring algorithms. It provides discriminated union handling, validation-based type selection, ambiguity resolution, and fallback mechanisms for complex scenarios involving multiple possible type interpretations.

## Relationship to Parent Requirements
This feature implements several key sections from `specifications/requirements.md`:

- **Schema Integration** (Section 4.1.2): Union type resolution within the scoring algorithm and type coercion system
- **Type Resolution Logic** (Section 5.3): Schema-first approach with quantitative scoring for union type resolution
- **Advanced Features** (Section 4.1.4): String priority logic when content could be parsed multiple ways
- **Error Handling & Reliability** (Section 4.2.2): Graceful degradation for ambiguous union cases
- **Core Parsing Engine** (Section 4.1.1): Integration with multi-strategy parser for union resolution

## Test-Driven Specifications
Based on test file: `test/unions.test.ts`

### Core Capabilities Tested

#### Basic Union Type Resolution
- **Object vs Object Unions**: Discriminating between different object schemas based on property structure
- **Object vs Array Unions**: Choosing between object and array types based on input structure
- **Primitive Type Unions**: Resolving between primitive types (string, number, boolean, null)
- **Nested Union Types**: Handling unions within complex nested structures

#### Discriminated Union Handling
- **Enum-Based Discrimination**: Using enum properties as discriminator fields for type selection
- **Property-Based Discrimination**: Selecting union members based on presence/absence of specific properties
- **Value-Based Discrimination**: Using property values to determine the appropriate union member
- **Complex Discriminated Unions**: Handling multi-level discriminated unions with nested structures

#### Validation-Driven Type Selection
- **Regex Validation**: Using string validation patterns (phone, email) to select correct union member
- **Schema Constraint Matching**: Selecting types based on schema validation success/failure
- **Format-Specific Validation**: Handling format-specific constraints (email, phone number patterns)
- **Cross-Validation**: Ensuring selected type passes all applicable validation rules

#### Ambiguity Resolution
- **String vs Number Priority**: Preferring string interpretation for ambiguous content in string|number unions
- **Type Precedence Rules**: Applying consistent priority ordering when multiple types could match
- **Content-Aware Selection**: Using content context to make intelligent type choices
- **Fallback Mechanisms**: Graceful handling when no union member provides perfect match

### Key Test Scenarios

1. **Basic Object Union Resolution**: Selecting between different object schemas
   ```typescript
   // Input: '{"hi": ["a", "b"]}'
   // Schema: z.union([{hi: z.array(z.string())}, {foo: z.string()}])
   // Expected: First object schema selected based on property match
   ```

2. **Object vs Array Union**: Discriminating between object and array alternatives
   ```typescript
   // Input: '{"hi": ["a", "b"]}'
   // Schema: z.union([{hi: z.array(z.string())}, z.array({foo: z.string()})])
   // Expected: Object schema selected over array schema
   ```

3. **Discriminated Union with Enums**: Using enum values for type discrimination
   ```typescript
   // Input: {"cat": "E", "item": "28558C", "data": null}
   // Schema: Union of objects with different cat enum values (A|C,D|E,F,G,H,I)
   // Expected: Third schema selected based on cat="E"
   ```

4. **Complex API Response Union**: Handling real-world API response structures
   ```typescript
   // Input: Complex nested object with action="RESPOND_TO_USER"
   // Schema: Union of different API response types
   // Expected: Correct response type selected based on action discriminator
   ```

5. **Validation-Based Selection**: Using regex/format validation for type selection
   ```typescript
   // Phone: '{"primary": {"value": "908-797-8281"}}'
   // Email: '{"primary": {"value": "help@boundaryml.com"}}'
   // Schema: Union of phone schema (regex) and email schema (email validation)
   // Expected: Appropriate schema selected based on validation success
   ```

6. **String Priority in Ambiguous Cases**: Preferring string over numeric parsing
   ```typescript
   // Input: "1 cup unsalted butter, room temperature"
   // Schema: z.union([z.number(), z.string()])
   // Expected: String type selected despite numeric content at start
   ```

7. **Mixed Content Extraction**: Handling JSON within markdown for union types
   ```typescript
   // Input: Markdown with JSON code block
   // Schema: Complex discriminated union
   // Expected: Correct type selected after content extraction
   ```

### Advanced Union Scenarios

#### Array Type Unions
- **Homogeneous Array Unions**: `z.union([z.array(z.string()), z.array(z.number())])`
- **Heterogeneous vs Homogeneous**: Choosing between mixed and typed arrays
- **Array vs Single Value**: Handling single values that could be arrays

#### Enum Union Combinations
- **Overlapping Enums**: Handling unions where enum values overlap between schemas
- **Disjoint Enums**: Clean separation between different enum value sets
- **Mixed Enum Types**: Combining enum unions with other type unions

#### Nested Union Complexity
- **Union Within Union**: Nested union types requiring recursive resolution
- **Optional Union Properties**: Handling unions with optional discriminator fields
- **Deep Object Unions**: Complex nested object structures with multiple union points

### Error Handling and Edge Cases

#### Malformed Input Handling
- **Graceful Degradation**: Never throwing exceptions for malformed union input
- **Best Effort Resolution**: Attempting to resolve type even with parsing errors
- **Error Recovery**: Using fixing parser capabilities within union resolution

#### Ambiguous Input Cases
- **No Clear Winner**: Handling input that doesn't clearly match any union member
- **Multiple Matches**: Dealing with input that could match multiple union members
- **Partial Matches**: Working with incomplete data that partially matches union schemas

#### Empty and Edge Inputs
- **Empty String Handling**: Resolving unions with empty input
- **Null Value Handling**: Proper null handling in nullable union types
- **Undefined Properties**: Managing missing properties in discriminated unions

### Expected Behavior

#### Type Selection Algorithm
1. **Discriminator-First**: Check for discriminator properties (enums, unique fields)
2. **Validation-Based**: Test input against each union member's validation rules
3. **Structure Matching**: Compare input structure against schema requirements
4. **Content Analysis**: Use content patterns to inform type selection
5. **Scoring System**: Apply quantitative scoring to select best match
6. **Fallback Rules**: Apply priority rules when scores are tied

#### Scoring Priorities
1. **Exact Match**: Perfect schema compliance receives highest score
2. **Discriminator Match**: Matching discriminator fields heavily weighted
3. **Validation Success**: Passing validation increases score significantly
4. **Type Compatibility**: Compatible types (coercible) receive positive scores
5. **String Priority**: String schemas receive bonus when content is ambiguous
6. **Structure Alignment**: Matching object/array structure improves score

#### Content Processing Rules
1. **Mixed Content Extraction**: Extract JSON from text before union resolution
2. **Code Block Processing**: Handle markdown code blocks in union context
3. **Multi-Object Scenarios**: Apply union resolution to each parsed object
4. **Streaming Support**: Handle partial union data in streaming scenarios

## Implementation Requirements

### Core Union Resolution Engine
- **Union Coercer**: Dedicated coercer implementation in `src/deserializer/coercer/union_coercer.ts`
- **Scoring Integration**: Deep integration with `src/deserializer/score.ts` scoring system
- **Type Testing**: Systematic testing of each union member against input data
- **Result Selection**: Algorithm for selecting best-scoring union member

### Discriminator Support
- **Enum Discrimination**: Special handling for enum-based discriminated unions  
- **Property Discrimination**: Detection and utilization of discriminator properties
- **Value-Based Selection**: Using property values for type determination
- **Hierarchical Discrimination**: Support for multi-level discriminated unions

### Validation Integration
- **Zod Schema Testing**: Testing input against each union member's Zod schema
- **Validation Scoring**: Incorporating validation results into scoring algorithm
- **Error Aggregation**: Collecting validation errors for debugging and fallbacks
- **Custom Validation**: Support for custom validation logic in union resolution

### Performance Optimization
- **Early Exit**: Stopping evaluation when perfect match found
- **Discriminator Fast Path**: Quick resolution for discriminated unions
- **Caching Strategy**: Caching union resolution results where appropriate
- **Lazy Evaluation**: Only evaluating union members as needed

## Success Criteria

### Core Functionality
- All tests in `unions.test.ts` pass (currently in development)
- Basic union resolution between object schemas works correctly
- Object vs array union discrimination functions properly
- Discriminated unions with enum discriminators resolve accurately

### Advanced Capabilities
- Complex API response unions handle real-world scenarios
- Validation-based union selection (regex, email, format) works correctly
- String priority logic properly handles ambiguous content
- Mixed content extraction integrates with union resolution

### Error Handling
- Malformed input handled gracefully without exceptions
- Empty and edge case inputs processed correctly
- Ambiguous cases resolve with consistent priority rules
- No union member match scenarios handled with appropriate fallbacks

### Integration Requirements
- Seamless integration with existing coercer system
- Proper integration with fixing parser for malformed union input
- Scoring system provides consistent and predictable results
- Union resolution works correctly in streaming and partial parsing scenarios

### Performance Standards
- Union resolution performance scales reasonably with number of union members
- Discriminated unions resolve quickly using fast-path optimization
- Complex nested unions resolve without excessive computational overhead
- Memory usage remains bounded even for large union schemas

### Behavioral Requirements
- Exact parity with Rust implementation behavior for all union test cases
- Consistent type selection across similar input scenarios
- Predictable behavior for edge cases and ambiguous inputs
- Integration with broader JSONish parsing pipeline maintains all existing capabilities