# Feature: Constraint Validation

## Overview
This feature provides comprehensive validation constraint support within the JSONish parser, enabling field-level, block-level, and complex constraint validation using Zod refinements. It implements a sophisticated constraint evaluation system that distinguishes between hard failures (asserts) and soft warnings (checks), allowing for flexible parsing behavior while maintaining schema integrity. The constraint system supports nested validations, union type constraints, and map/record validations with intelligent constraint evaluation during type coercion.

## Relationship to Parent Requirements
This feature implements several key sections from `specifications/requirements.md`:

- **Schema Integration** (Section 4.1.2): Zod schema support with validation integration and proper error messages
- **Type Resolution Logic** (Section 5.3): Schema-first approach with validation integration for immediate feedback
- **Error Handling & Reliability** (Section 4.2.2): Validation errors with clear, actionable error messages and graceful degradation
- **Advanced Features** (Section 4.1.4): Complex validation scenarios and nested structure handling
- **Type Coercion System**: Integration of constraint validation within the coercion process

## Test-Driven Specifications
Based on test file: `test/constraints.test.ts`

### Core Capabilities Tested

#### Field-Level Constraints
- **Single Field Validation**: Individual field constraints using Zod refinements
- **Multiple Constraint Chains**: Multiple refinements applied to single fields with different validation rules
- **Constraint Severity**: Differentiation between warnings (checks) and hard failures (asserts)
- **Custom Error Messages**: Support for custom validation error messages in constraint definitions

#### Union Type Constraints
- **Variant Selection**: Using constraints to guide union type resolution and variant selection
- **Constraint-Based Scoring**: Leveraging constraint satisfaction in type matching scores
- **Ambiguous Value Handling**: Managing union values that don't fully satisfy any variant constraints
- **Array-Level Constraints**: Constraints applied to collections of union types

#### Map/Record Constraints
- **Record Validation**: Constraints applied to entire map/record structures
- **Key-Value Constraints**: Validation rules that depend on specific key-value relationships
- **Dynamic Validation**: Constraints that evaluate based on runtime map contents

#### Nested Structure Constraints
- **Hierarchical Validation**: Constraints within nested objects and complex structures
- **Propagation Rules**: How constraint failures propagate through nested hierarchies
- **Context Preservation**: Maintaining validation context across nested levels

#### Block-Level Constraints
- **Object-Level Validation**: Constraints applied to entire objects after field parsing
- **Cross-Field Validation**: Constraints that validate relationships between multiple fields
- **Enum Constraints**: Block-level constraints applied to enum values
- **Multiple Block Constraints**: Handling multiple, potentially conflicting block-level validations

### Key Test Scenarios

1. **Field Constraint Evaluation**: Field-level refinements with warning vs error behavior
   - Passing constraints: `{"age": 5, "name": "Greg"}` with age >= 0 and name non-empty
   - Warning on failure: `{"age": 11, "name": "Greg"}` with age < 10 constraint (warning, parsing succeeds)
   - Hard failure: `{"age": -1, "name": "Sam"}` with age >= 0 assert (throws error)

2. **Multiple Constraint Chains**: Fields with multiple sequential refinements
   - Multiple checks: age >= 0, age < 10, age < 20 applied in sequence
   - Partial satisfaction: value satisfies some but not all constraints (warnings for failures)
   - Complete failure: value fails multiple constraints (multiple warnings or errors)

3. **Union Constraint-Based Selection**: Using constraints to select union variants
   - Small value selection: `{"bar": 5}` matches Thing1Schema (bar < 10)
   - Large value selection: `{"bar": 25}` matches Thing2Schema (bar > 20)
   - Ambiguous values: `{"bar": 15}` doesn't fully match either variant (arbitrary selection)

4. **Map Constraint Validation**: Validation rules applied to record/map structures
   - Key-specific constraints: `{"foo": {"hello": 10, "there": 13}}` with hello === 10 requirement
   - Constraint failures: `{"foo": {"hello": 11, "there": 13}}` fails hello === 10 (warning behavior)

5. **Block-Level Assertions**: Object-level constraints after field parsing
   - Object validation: `{"foo": 1}` with object-level constraint foo > 0 (passes)
   - Block failure: `{"foo": -1}` with foo > 0 constraint (hard failure)
   - Enum block constraints: "TWO" passes enum === "TWO", "THREE" fails

6. **Conflicting Block Constraints**: Multiple block-level constraints with impossible satisfaction
   - Conflicting requirements: foo < 0 AND foo > 0 (impossible to satisfy)
   - All values fail: positive, negative, and zero all fail conflicting constraints

### Edge Cases Covered

- **Nested Constraint Propagation**: `{"inner": {"value": 15}}` with inner.value < 10 constraint
- **Array Length Constraints**: `{"things": [item1, item2, item3, item4]}` with length < 4 requirement
- **Empty String Validation**: `{"name": ""}` with non-empty string constraint
- **Negative Number Handling**: Age fields with non-negative requirements
- **Multiple Assert Failures**: Objects failing multiple field-level assertions simultaneously
- **Zero Value Edge Cases**: Numeric constraints with zero boundary conditions

### Expected Behavior

#### Constraint Evaluation Rules
1. **Warning vs Error Distinction**: Some constraints generate warnings (parsing continues), others cause hard failures
2. **Sequential Evaluation**: Multiple constraints on same field evaluated in definition order
3. **Early Termination**: Hard assertion failures stop parsing immediately
4. **Context Preservation**: Constraint failures maintain parsing context for error reporting

#### Union Type Resolution
1. **Constraint-Guided Selection**: Constraints influence which union variant is selected
2. **Satisfaction Scoring**: Variants that satisfy more constraints score higher
3. **Fallback Selection**: When no variant fully satisfies constraints, arbitrary selection with warnings
4. **Constraint Propagation**: Union-level constraints apply to selected variant

#### Error Handling Strategy
1. **Structured Error Messages**: Clear indication of which constraints failed and why
2. **Custom Error Messages**: Support for constraint-specific error messages from schema
3. **Multiple Failure Reporting**: Ability to report multiple constraint violations
4. **Validation Context**: Errors include field paths and constraint details

#### Performance Considerations
1. **Lazy Evaluation**: Constraints evaluated only when necessary during coercion
2. **Early Termination**: Stop constraint evaluation on first hard failure
3. **Caching**: Avoid re-evaluating same constraints multiple times
4. **Minimal Overhead**: Constraint validation should not significantly impact parsing performance

## Implementation Requirements

### Constraint System Architecture
- **Validation Pipeline**: Integration of constraint validation within type coercion process
- **Severity Classification**: Distinguish between warning-level checks and error-level asserts
- **Error Accumulation**: Collect and report multiple constraint violations appropriately
- **Context Tracking**: Maintain validation context for meaningful error messages

### Zod Integration
- **Refinement Support**: Complete support for Zod .refine() method with custom messages
- **Schema Introspection**: Ability to analyze schema constraints during parsing
- **Error Mapping**: Convert Zod validation errors to JSONish constraint violation format
- **Performance Optimization**: Efficient evaluation of refinement functions

### Union Type Enhancement
- **Constraint-Aware Scoring**: Incorporate constraint satisfaction into union type scoring
- **Variant Filtering**: Use constraints to filter possible union variants before detailed evaluation
- **Conflict Resolution**: Handle cases where multiple variants partially satisfy constraints
- **Selection Reporting**: Provide feedback on why specific union variants were selected

### Nested Validation Support
- **Hierarchical Context**: Maintain validation context through nested object structures
- **Path Tracking**: Track field paths for constraint violations in nested structures
- **Propagation Rules**: Define how constraint failures propagate up the object hierarchy
- **Recursive Validation**: Handle deeply nested structures with recursive constraint evaluation

## Success Criteria

### Core Functionality
- All tests in `constraints.test.ts` pass (54 test scenarios across 6 constraint categories)
- Proper distinction between warning-level checks and error-level assertions
- Accurate constraint evaluation for all supported data types and structures
- Integration with existing type coercion system without performance degradation

### Error Handling Quality
- Clear, actionable error messages for all constraint violation types
- Proper error context including field paths and constraint details
- Graceful handling of multiple simultaneous constraint failures
- Structured error format compatible with existing JSONish error handling

### Union Type Resolution
- Constraint satisfaction properly influences union variant selection
- Ambiguous cases handled gracefully with appropriate warnings
- Performance remains acceptable even with complex constraint evaluation
- Accurate scoring that balances type matching and constraint satisfaction

### Integration Requirements
- Seamless integration with existing deserializer and coercer system
- Constraint validation occurs at appropriate points in parsing pipeline
- No breaking changes to existing parser API or behavior
- Maintains exact behavioral parity with Rust implementation constraint handling