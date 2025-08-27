# Create Implementation Strategy Document

You are tasked with creating detailed implementation strategy documents through an interactive, iterative process. These documents bridge the gap between requirements and actual code implementation for the JSONish parser library. You should be thorough, technically focused, and work collaboratively to produce actionable implementation plans. Do not write code - this is an implementation **plan**.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a requirements document path was provided as a parameter, skip the default message
   - Immediately read the requirements document FULLY
   - Begin the analysis process

2. **If no parameters provided**, respond with:
```
I'll help you create a detailed implementation strategy for JSONish. Let me start by understanding the requirements.

Please provide:
1. The requirements document path (e.g., specifications/feature-name/requirements.md)
2. Any existing parser/coercer implementations to consider
3. Any technical constraints or preferences (e.g., specific Zod schemas, error handling approaches)

I'll analyze the requirements and work with you to create a comprehensive implementation strategy.

Tip: You can invoke this command with requirements: `/create_implementation_strategy specifications/feature-name/requirements.md`
```

Then wait for the user's input.

## Process Steps

### Step 1: Requirements Analysis & Research

1. **Read requirements document completely**:
   should be at `specifications/feature-name/requirements.md` or similar.
   - Use the Read tool WITHOUT limit/offset parameters
   - Understand all user stories and functional requirements
   - Note any design considerations and constraints
   - Identify success criteria

2. **Spawn focused research tasks**:
   Before asking questions, spawn parallel research tasks to understand the implementation context:

   ```
   Task 1 - Research current parser implementation:
   Research how the JSONish parser currently handles similar features.
   1. Find existing parser components in src/jsonish/parser/ related to [feature area]
   2. Identify error recovery patterns in src/jsonish/parser/fixing-parser/
   3. Look for value representation in src/jsonish/value.ts
   4. Check test cases in test/*.test.ts for similar parsing scenarios
   5. Note any existing helper utilities in src/helpers/
   Use tools: Grep, Glob, LS, Read
   Return: Current implementation details with file:line references
   ```

   ```
   Task 2 - Identify coercer and deserializer patterns:
   Research the type coercion system for this implementation.
   1. Find relevant coercer implementations in src/deserializer/coercer/
   2. Check IR ref types in src/deserializer/coercer/ir_ref/ (alias, class, enum)
   3. Identify Zod schema usage patterns and validation approaches
   4. Find scoring system usage in src/deserializer/score.ts
   5. Look for deserialization patterns in src/deserializer/deserializer.ts
   Return: Technical patterns and examples with file references
   ```

   ```
   Task 3 - Research integration and configuration:
   1. Find where [feature] would integrate with entry_parser.ts
   2. Check for existing interfaces in deserializer.ts and value.ts
   3. Look for configuration flags in src/deserializer/flags.ts
   4. Identify test patterns for similar features (streaming, partials, unions)
   5. Find related TypeScript types and Zod schemas
   Return: Integration requirements and constraints
   ```
3. **Wait for ALL sub-tasks to complete** before proceeding

4. **Read all files identified by research**:
   - Read relevant files completely into main context including requirements.
   - Understand existing patterns and conventions
   - Identify reusable components and utilities

5. **Present analysis and ask clarifications**:
   ```
   Based on the requirements and my research, I understand we need to implement [summary].

   **Current State:**
   - [Key discovery about JSONish parser architecture]
   - [Existing coercer pattern to follow]
   - [Technical constraints from Zod schemas or value types]

   Questions to finalize the strategy:
   - [Critical decision about parser vs deserializer implementation]
   - [Approach for handling malformed JSON edge cases]
   - [Type coercion strategy for ambiguous values]

   **Design Options:**
   1. [Option A - Parser-level implementation] - [pros/cons]
   2. [Option B - Coercer-level implementation] - [pros/cons]

   **Open Questions:**
   - [Uncertainty about error recovery approach]
   - [Decision needed for streaming/partial support]

   Which approach aligns best with your vision?

   ```

### Step 2: Strategy Development

1. **Design the implementation approach**:
   - Determine phase breakdown strategy
   - Identify dependencies and sequencing
   - Choose technical patterns to follow
   - Plan data flow through parser → value → deserializer → coercer chain

2. **Present strategy outline**:
   ```
   Here's my proposed implementation strategy:

   ## Overview
   [1-2 sentence summary of approach]

   ## Phases:
   1. [Phase name] - [what it establishes]
   2. [Phase name] - [what it builds on phase 1]
   3. [Phase name] - [what it completes]

   Does this phasing approach make sense? Any adjustments needed?
   ```

3. **Get feedback on strategy** before writing detailed plan

### Step 3: Gather Metadata and Write Implementation Plan

1. **Gather metadata for the implementation strategy document:**
   - Get git commit hash: `git rev-parse HEAD`
   - Get branch name: `git branch --show-current`
   - Filename: should be under the `specifications` directory for the feature that you're currently working on, e.g. `specifications/01-better-json-recovery/implementation-plan.md`, or under `specifications/general` if you don't have information about which feature you're working on. Name the file `implementation-plan.md`

2. **Generate implementation strategy document:**
   - Structure the document with YAML frontmatter followed by content:
     ```markdown
     ---
     date: [Current date and time with timezone in ISO format]
     researcher: Claude
     git_commit: [Current commit hash from git rev-parse HEAD]
     branch: [Current branch name from git branch --show-current]
     repository: jsonish
     topic: "[Feature/Task Name] Implementation Strategy"
     tags: [implementation, strategy, parser, deserializer, coercer, jsonish]
     status: complete
     last_updated: [Current date in YYYY-MM-DD format]
     last_updated_by: Claude
     type: implementation_strategy
     ---

# [Feature/Task Name] Implementation Plan

## Overview

[Brief description of what we're implementing and why - focused on JSONish parsing capabilities]

## Current State Analysis

[What exists in the parser/deserializer, what's missing, key constraints discovered]

### Key Discoveries:
- [Important finding about parser architecture with file:line reference]
- [Coercer pattern to follow with example]
- [Zod schema constraint or value type limitation]

## What We're NOT Doing

[Explicitly list out-of-scope items to prevent scope creep]

## Implementation Approach

[High-level strategy focusing on parser → value → deserializer → coercer flow]

## Phase 1: [Descriptive Name]

### Overview
[What this phase accomplishes in the JSONish pipeline]

### Changes Required:

#### 1. [Parser/Coercer/Deserializer Component]
**File**: `src/jsonish/parser/[file].ts` or `src/deserializer/coercer/[file].ts`
**Changes**: [Summary of changes]

   ```typescript
   // specific code to add/modify
   ```

[Add additional phases as necessary]

### Success Criteria:

**Automated verification**
- [ ] `bun run tests` passes all tests
- [ ] `bun build` completes without errors
- [ ] No TypeScript errors

**Manual Verification**
- [ ] Feature correctly parses malformed JSON examples
- [ ] Type coercion works as expected
- [ ] Edge cases (streaming, partials) are handled
- [ ] No regressions in existing test suite

## Phase 2: [Descriptive Name]
[similar structure with both automated and manual success criteria...]

## Test Strategy

### Unit Tests
- [ ] Parser tests in `test/[feature].test.ts`
- [ ] Coercer tests for type conversion
- [ ] Edge case coverage for malformed input

### Integration Tests
- [ ] End-to-end parsing with Zod schemas
- [ ] Union type resolution scenarios
- [ ] Streaming/partial JSON handling

## Performance Considerations
[Parser performance, coercion overhead, memory usage]

## Migration Notes
[If applicable, how existing parsers/coercers need updates]

## References 
* Original requirements: `specifications/feature-name/requirements.md`
* Related research: `specifications/feature-name/artifacts/research.md`
* Similar implementation: `src/deserializer/coercer/[example].ts:line`
* Test examples: `test/[similar-feature].test.ts`

```

### Step 4: Review & Refinement

1. **Save document to**: `specifications/[feature-name]/implementation-plan.md` or `specifications/[feature-name]/[sub-feature-name]/implementation-plan.md`
   NOTE: if the feature is large, ask the user:


2. **Present for review**:
   ```
   Implementation strategy created at: specifications/[feature-area]/implementation-plan.md

   Please review:
   - Do the phases make sense and build on each other?
   - Are the tasks specific enough to be actionable?
   - Any technical decisions that need adjustment?
   - Ready to begin implementation?
   ```

3. **Iterate based on feedback**:
   - Adjust phase sequencing
   - Add missing technical details
   - Clarify task descriptions
   - Update architectural decisions

## Guidelines
1. **Be Skeptical**:
- Question vague requirements
- Identify potential issues early
- Ask "why" and "what about"
- Don't assume - verify with code

2. **Be Interactive**:
- Don't write the full plan in one shot
- Get buy-in at each major step
- Allow course corrections
- Work collaboratively

3. **Be Thorough**:
- Read all context files COMPLETELY before planning
- Research actual code patterns using parallel sub-tasks
- Include specific file paths and line numbers
- Write measurable success criteria with clear automated vs manual distinction
- Automated steps should use `bun test` and `bun build` commands
- Consider both parser and deserializer layers

4. **Be Practical**:
- Focus on incremental, testable changes
- Consider migration and rollback
- Think about edge cases
- Include "what we're NOT doing"

5. **Track Progress**:
- Use TodoWrite to track planning tasks
- Update todos as you complete research
- Mark planning tasks complete when done

6. **No Open Questions in Final Plan**:
- If you encounter open questions during planning, STOP
- Research or ask for clarification immediately
- Do NOT write the plan with unresolved questions
- The implementation plan must be complete and actionable
- Every decision must be made before finalizing the plan

### Focus on Implementation Details
- Break down requirements into specific, actionable tasks
- Include exact file paths and component names where possible
- Reference existing patterns and examples
- Plan for incremental development and testing

### Follow JSONish Patterns
- Use established coercer patterns in src/deserializer/coercer/
- Follow parser patterns in src/jsonish/parser/
- Leverage Zod schemas for type validation
- Use Bun test runner conventions (describe/it/expect)
- Maintain error recovery approaches from fixing-parser/
- Follow value representation patterns from value.ts

### Be Thorough but Actionable
- Every task should be specific enough to implement
- Include technical context and file references
- Plan for both happy path and error scenarios
- Consider testing strategy from the beginning

### Research-Driven Approach
- Always research existing implementations first
- Identify reusable patterns and components
- Understand current conventions and follow them
- Verify technical assumptions with actual code

### Interactive Planning
- Get feedback on strategy before detailed tasks
- Collaborate on technical approach decisions
- Allow for course corrections during planning
- Ask clarifying questions about requirements

## Quality Checklist

Before finalizing:

- [ ] Requirements are clearly understood and addressed
- [ ] Tasks are specific and actionable
- [ ] Technical patterns follow existing conventions
- [ ] Phases build logically on each other
- [ ] File paths and references are accurate
- [ ] Success criteria match requirements

## Common JSONish Patterns

### Parser Implementation
- Entry point through `src/jsonish/parser/entry_parser.ts`
- Error recovery in `src/jsonish/parser/fixing-parser/`
- Value representation using `src/jsonish/value.ts` types
- Streaming support for partial JSON
- Mixed content extraction from text/markdown

### Deserializer & Coercer Architecture
- Main deserializer logic in `src/deserializer/deserializer.ts`
- Type-specific coercers in `src/deserializer/coercer/`
- IR ref types in `src/deserializer/coercer/ir_ref/` (alias, class, enum)
- Scoring system in `src/deserializer/score.ts` for union resolution
- Flags in `src/deserializer/flags.ts` for parsing options

### Zod Schema Integration
- Schema validation throughout the pipeline
- Type coercion based on expected schemas
- Union type discrimination with scoring
- Error handling and recovery

### Testing Patterns
- Comprehensive test suite using Bun test runner
- Test organization: basics, class-*, enum, unions, streaming, partials
- Real-world malformed JSON test cases
- Edge case coverage for error recovery

## Common Implementation Patterns

### For New Coercers:
1. Create coercer in `src/deserializer/coercer/[name]_coercer.ts`
2. Follow existing patterns (array_coercer, map_coercer, etc.)
3. Implement score() and coerce() methods
4. Add unit tests in `test/[feature].test.ts`
5. Update deserializer.ts to use new coercer
6. Test with malformed input scenarios

### For Parser Features:
1. Research existing patterns in parser/
2. Define value representation in value.ts
3. Implement parsing logic in appropriate parser file
4. Add error recovery in fixing-parser/
5. Test with streaming and partial input
6. Ensure mixed content extraction works

### For Bug Fixes:
1. Create failing test case first
2. Trace through parser → value → deserializer → coercer flow
3. Implement minimal fix maintaining existing patterns
4. Verify no regressions with full test suite
5. Update related tests if behavior changes

## Sub-task Spawning Best Practices

When spawning research sub-tasks:

1. **Spawn multiple tasks in parallel** for efficiency
2. **Each task should be focused** on a specific area
3. **Provide detailed instructions** including:
   - Exactly what to search for
   - Which directories to focus on
   - What information to extract
   - Expected output format
4. **Be EXTREMELY specific about JSONish directories**:
   - Parser logic: `src/jsonish/parser/` and `src/jsonish/parser/fixing-parser/`
   - Coercers: `src/deserializer/coercer/` and `src/deserializer/coercer/ir_ref/`
   - Deserializer: `src/deserializer/deserializer.ts`
   - Value types: `src/jsonish/value.ts`
   - Tests: `test/` with specific files like `test/basics.test.ts`, `test/unions.test.ts`
   - Helpers: `src/helpers/`
   - Include the full path context in your prompts
5. **Specify read-only tools** to use
6. **Request specific file:line references** in responses
7. **Wait for all tasks to complete** before synthesizing
8. **Verify sub-task results**:
   - If a sub-task returns unexpected results, spawn follow-up tasks
   - Cross-check findings against the actual codebase
   - Don't accept results that seem incorrect

Example of spawning multiple tasks:
```python
# Spawn these tasks concurrently:
tasks = [
    Task("Research parser patterns", parser_research_prompt),
    Task("Find coercer implementations", coercer_research_prompt),
    Task("Investigate test patterns", test_research_prompt),
    Task("Check type definitions", types_research_prompt)
]
```

## Example Interaction Flow

```
User: /create_implementation_strategy
Assistant: I'll help you create a detailed implementation strategy for JSONish...

User: We need to add support for parsing fractional numbers with underscores. See specifications/fractional-underscore-parsing/requirements.md
Assistant: Let me read that requirements file completely first...

[Reads file fully]

Based on the requirements, I understand we need to add support for parsing fractional numbers with underscores (e.g., "1_234.567_890") to JSONish. Let me research the current implementation...

[Spawns parallel research tasks for parser, coercer, and test patterns]

Based on my research:
- The parser currently handles number parsing in src/jsonish/parser/[file]
- The primitive_coercer handles number type coercion
- Similar number parsing tests exist in test/basics.test.ts

Before I create the implementation plan, I have some questions:
1. Should underscore support be added at the parser level or during coercion?
2. How should we handle edge cases like leading/trailing underscores?
3. Should this work for both JSON numbers and numbers in mixed content?

[Interactive process continues...]
```