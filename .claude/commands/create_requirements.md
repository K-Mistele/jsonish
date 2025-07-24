# Create Requirements Document Command

You are tasked with creating detailed, actionable requirements documents for the JSONish TypeScript parser library through an interactive, iterative process. You should be thorough, developer-focused, and work collaboratively to produce high-quality specifications that lead to successful parser implementations.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a parser feature, API enhancement, or specification was provided as a parameter, skip the default message
   - Begin the analysis process immediately
   - If files are referenced, read them FULLY first

2. **If no parameters provided**, respond with:
```
I'll help you create a comprehensive requirements document for the JSONish parser library. Let me start by understanding what we're building.

Please provide:
1. The parser feature/API you want to specify (e.g., new parsing mode, error recovery, API method)
2. Developer use cases or parsing scenarios this addresses
3. Links to related research, test cases, or reference implementations
4. Any constraints (performance targets, compatibility, streaming requirements)

I'll analyze this information and work with you to create detailed requirements.

Tip: You can also invoke this command with context: `/create_requirements enhanced error recovery for nested objects` or `/create_requirements based on research/streaming_improvements.md`
```

Then wait for the user's input.

## Process Steps

### Step 1: Context Gathering & Problem Understanding

1. **Read all referenced files immediately and FULLY**:
   - Research documents related to the parser feature (e.g., for streaming improvements look under `specifications/streaming/`)
   - Related test cases and existing implementations
   - **Important**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: DO NOT spawn sub-tasks before reading these files yourself in the main context
   - **NEVER** read files partially - if a file is mentioned, read it completely

2. **Spawn focused research tasks** (only if needed for complex features):
   ```
   Task 1 - Research current parser implementation:
   Find how [the parsing feature] currently works in the codebase.
   1. Locate relevant parser modules and coercers
   2. Identify existing parsing patterns and error recovery
   3. Look for similar parsing features to model after
   Return: Key files and patterns with file:line references
   ```

3. **Understand the core parsing problem**:
   - What parsing scenario are we improving?
   - What malformed JSON patterns should we handle?
   - Performance requirements and constraints?

4. **Confirm understanding and get clarification**:
   ```
   I understand you want to [accurate summary of parsing feature].

   Key findings:
   - [Current parser behavior/limitations]
   - [Performance/compatibility constraints]

   Questions:
   - [Parsing edge cases to handle?]
   - [API design preferences?]
   ```

### Step 1.5: Feature Sizing Clarification
1. **Feature sizing**:
   Think hard about the size of the parser feature. If the implementation will be very complex (e.g., major parser refactor, new parsing mode), consider asking the user if they would like to break it down into multiple sub-features:

   ```
   This parser feature seems quite large! Would you like me to break it down into sub-features (e.g., lexer changes, parser logic, error recovery), or proceed with one unified document?
   ```
   
2. **Subfeature definition**: 
   **If the user asks you to proceed with a unified document, skip this section**.
   If the user asks you to break it into sub-features:

   - Suggest how the parser feature may be broken down (e.g., tokenization, AST construction, type coercion)
   - Create sub-feature directories: `specifications/feature-name/lexer-improvements`, `specifications/feature-name/error-recovery`, etc.
   - Under each sub-feature directory, create a `feature.md` with:
     - What parsing aspect this sub-feature addresses
     - How it relates to other parser components
     - Test cases and examples
   - Create `specifications/feature-name/feature-definition-checklist.md` to track sub-features
   - Ask the user:

   ```
   I have set up sub-feature directories and tracking documents. Please clear the session and re-initialize the requirements definition workflow for the specific sub-feature.
   ```


### Step 2: Core User Stories

1. **Focus on primary parsing scenarios**:
   - Common JSON parsing use cases
   - Malformed JSON recovery scenarios
   - Streaming/partial parsing needs

2. **Write stories in given/when/then format**:
   ```
   Key user stories:

   1. **Given** malformed JSON with missing commas, **when** parsed, **then** returns valid object structure
   2. **Given** streaming JSON data, **when** partial data arrives, **then** returns partial parse result

   Do these cover the core parsing scenarios?
   ```

### Step 3: Essential Requirements

1. **Define what must work**:
   - Core parsing functionality
   - Error recovery mechanisms
   - Type coercion accuracy
   - API compatibility

2. **Note constraints**:
   - Performance targets
   - Memory usage limits
   - Zod schema integration

### Step 4: Gather Metadata and Write Requirements Document

1. **Gather metadata for the requirements document:**
   - Get current git commit hash and branch information
   - Note the JSONish library version and dependencies

2. **Write the document directly using the parser-specific template**

Keep it focused on parser functionality and include proper metadata.

Use this template:

```markdown
---
date: [Current date and time with timezone in ISO format]
author: [Author name]
git_commit: [Current commit hash]
branch: [Current branch name]
repository: jsonish
topic: "[Parser Feature] Requirements"
tags: [requirements, parser, relevant-feature-tags]
status: complete
last_updated: [Current date in YYYY-MM-DD format]
type: requirements
---

# Requirements for [Parser Feature Name]

## Goal
[Clear statement of the parsing problem being solved and why it matters for developers]

## Important Context

### Current Parser Architecture
- **Entry Point**: `src/jsonish/parser/entry_parser.ts`
- **Error Recovery**: `src/jsonish/parser/fixing-parser/`
- **Value System**: `src/jsonish/value.ts`
- **Deserializer**: `src/deserializer/deserializer.ts`
- **Coercers**: `src/deserializer/coercer/`

### Existing Implementation
[Description of current parser behavior, limitations, and relevant code locations]

### Integration Points
- Zod schema validation
- Streaming parser interface
- Error recovery mechanisms

## User Stories
(in given/when/then format)

### Basic Parsing
1. **Developer**: Parse malformed JSON with missing commas - **Given** JSON like `{"a": 1 "b": 2}`, **when** parsed, **then** returns valid object `{a: 1, b: 2}`

2. **Developer**: Extract JSON from mixed content - **Given** markdown with embedded JSON, **when** parsed, **then** extracts and returns the JSON structure

### Error Recovery
1. **Developer**: Handle trailing commas gracefully - **Given** JSON with trailing comma, **when** parsed, **then** ignores comma and returns valid structure

### Type Coercion
1. **Developer**: Coerce string to number when schema expects number - **Given** `{"age": "25"}` with number schema, **when** parsed, **then** returns `{age: 25}`

## Requirements

### Functional Requirements
- Parse valid JSON according to RFC 8259
- Recover from common JSON syntax errors:
  - Missing commas between properties
  - Trailing commas in objects/arrays
  - Single quotes instead of double quotes
  - Comments (// and /* */)
- Extract JSON from mixed text content
- Support streaming/partial JSON parsing
- Integrate with Zod schemas for validation
- Provide detailed error information

### Non-Functional Requirements

#### Performance
- Parse 1MB JSON files in under 100ms
- Minimal memory overhead for streaming
- Efficient error recovery without full reparse

#### Compatibility
- Full TypeScript type safety
- Works with Bun and Node.js runtimes
- Compatible with existing Zod schemas

#### Developer Experience
- Clear, actionable error messages
- Intuitive API surface
- Comprehensive TypeScript types

## API Design

### Core API
```typescript
// Example API structure
interface ParserOptions {
  schema?: ZodSchema;
  mode?: 'strict' | 'lenient';
  streaming?: boolean;
}

function parse<T>(input: string, options?: ParserOptions): T;
function parsePartial<T>(input: string, schema: ZodSchema<T>): Partial<T>;
```

### Error Handling
- Return structured errors with location info
- Provide recovery suggestions
- Support error aggregation for multiple issues

## Test Coverage

### Test Categories
- Basic JSON parsing (RFC compliance)
- Malformed JSON recovery scenarios
- Type coercion with schemas
- Streaming/partial parsing
- Union type resolution
- Performance benchmarks

### Edge Cases
- Deeply nested structures
- Large arrays/objects
- Unicode handling
- Number precision
- Circular reference detection

## Success Criteria

### Parsing Accuracy
- Passes all 236+ existing test cases
- Correctly handles documented malformed patterns
- Maintains compatibility with Rust implementation

### Performance Targets
- Meets or exceeds performance benchmarks
- Efficient memory usage for large inputs
- Fast error recovery

### Developer Adoption
- Clear migration path from standard JSON.parse
- Comprehensive documentation
- Type-safe API with good IDE support
```

### Step 5: Quick Review

1. **Save document to**: `specifications/[parser-feature]/requirements.md`

2. **Ask for focused feedback**:
   ```
   Requirements document created at: specifications/[path]/requirements.md

   Quick check:
   - Do the parsing scenarios cover your use cases?
   - Any missing error recovery patterns?
   - Is the API design intuitive for your needs?
   - Ready to implement or need adjustments?
   ```

## Guidelines

### Focus on Parser Excellence
- Cover core parsing scenarios and error recovery
- Include malformed JSON handling patterns
- Follow existing parser architecture
- Ensure compatibility with test suite

### Be Specific
- Write clear parsing scenarios in given/when/then format
- Include specific JSON examples and expected outputs
- Reference actual parser modules and coercers

### Research Efficiently
- Study existing test cases first
- Analyze current parser implementation
- Review Rust implementation for parity

## Quality Checklist

Before finalizing:

- [ ] Goal addresses real parsing challenges
- [ ] User stories cover common JSON errors
- [ ] API design is developer-friendly
- [ ] Performance requirements are realistic
- [ ] Test coverage is comprehensive

## Common Patterns for JSONish

### Parser Architecture
- Entry parser handles initial parsing
- Fixing parser recovers from errors
- Value system represents parsed data
- Deserializer applies type coercion

### Error Recovery Strategies
- Missing comma detection and insertion
- Quote normalization (single to double)
- Comment stripping
- Trailing comma removal

### Type Coercion Flow
- Parse to generic Value representation
- Apply Zod schema if provided
- Use coercers for type conversion
- Score matches for union types

### Testing Patterns
- Unit tests for each coercer
- Integration tests for full parsing
- Streaming tests for partial data
- Performance benchmarks

## Addenda:
* Ask for parsing examples and edge cases frequently
* Probe for specific malformed JSON patterns they encounter
* Collaborate on API design decisions
* Consider developer ergonomics throughout
* Note any compatibility requirements with existing code
