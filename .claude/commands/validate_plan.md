# Validate Plan

You are tasked with validating that an implementation plan was correctly executed for the JSONish TypeScript parser library, verifying all success criteria and identifying any deviations or issues.

## Initial Setup

When invoked:
1. **Determine context** - Are you in an existing conversation or starting fresh?
   - If existing: Review what was implemented in this session
   - If fresh: Need to discover what was done through git and codebase analysis

2. **Locate the plan**:
   - If plan path provided, use it
   - Otherwise, search recent commits for plan references or ask user
   - Look in `specifications/*/implementation-plan.md` or `specifications/*/*/implementation-plan.md`

3. **Gather implementation evidence**:
   ```bash
   # Check recent commits
   git log --oneline -n 20
   git diff HEAD~N..HEAD  # Where N covers implementation commits

   # Run JSONish test suite (236+ tests) -- NOT bun test since that will catch some tests we don't want.
   bun run tests
   bun test:coverage  # If available
   
   # Build and type check
   bun build
   bun build:declaration
   ```

## Validation Process

### Step 1: Context Discovery

If starting fresh or need more context:

1. **Read the implementation plan** completely using Read tool (WITHOUT limit/offset)
2. **Identify what should have changed**:
   - List all parser/deserializer/coercer files that should be modified
   - Note all success criteria (test cases, performance benchmarks)
   - Identify key parser functionality to verify
   - Check if new coercers or parser features were specified

3. **Spawn parallel research tasks** to discover implementation:
   ```
   Task 1 - Verify parser implementation:
   Research if parser components were added/modified as planned.
   Check: src/jsonish/parser/, entry_parser.ts, fixing-parser/
   Look for: error recovery logic, streaming support, partial parsing
   Return: Parser features implemented vs plan specifications

   Task 2 - Verify deserializer and coercers:
   Find all coercers that should have been added/modified.
   Check: src/deserializer/coercer/, deserializer.ts, score.ts
   Look for: new type coercers, scoring logic, type resolution
   Return: Coercer implementation vs plan requirements

   Task 3 - Verify test coverage:
   Check if test cases were added/updated as specified.
   Look in: test/*.test.ts files
   Check: edge cases, malformed JSON scenarios, streaming tests
   Return: Test coverage vs plan requirements (aim for 236+ tests)

   Task 4 - Verify TypeScript types and Zod schemas:
   Check if type definitions and Zod schemas are correctly implemented.
   Look for: proper type exports, Zod schema validation, type inference
   Return: Type safety and schema validation compliance
   ```

### Step 2: Systematic Validation

For each phase in the implementation plan document:

1. **Check completion status**:
   - Look for checkmarks in the plan (- [x])
   - Verify the actual code matches claimed completion

2. **Run automated verification**:
   - Execute each command from "Automated Verification" section
   - Use JSONish specific validation:
     ```bash
     # Run full test suite -- NOT bun test since that will catch tests we don't want
     bun run tests 
     
     # Run specific test categories
     bun test ./test/basics.test.ts
     bun test ./test/streaming.test.ts
     bun test ./test/unions.test.ts
     bun test ./test/partials.test.ts
     
     # Check type safety
     bun build:declaration
     
     # Lint with Biome
     bun lint
     ```
   - Document pass/fail status
   - If failures, investigate root cause

3. **Assess parser-specific criteria**:
   - Test malformed JSON handling (missing commas, quotes, brackets)
   - Verify mixed content extraction (JSON in markdown/text)
   - Check streaming/partial JSON parsing
   - Test union type resolution and scoring
   - Verify error recovery mechanisms

4. **Think deeply about parser architecture**:
   - Is the parser → value → deserializer → coercer flow correct?
   - Are coercers handling type conversions properly?
   - Is the scoring system selecting optimal types from unions?
   - Are partial/incomplete objects handled gracefully?
   - Is error recovery attempting appropriate fixes?
   - Are Zod schemas properly integrated for validation?

### Step 3: Generate Validation Report

Create comprehensive validation summary:

```markdown
## Validation Report: [Plan Name]

### Implementation Status
✅ Phase 1: [Name] - Fully implemented
✅ Phase 2: [Name] - Fully implemented  
⚠️ Phase 3: [Name] - Partially implemented (see issues)

### Automated Verification Results
✅ Test suite passes: `bun test` (236/236 tests)
✅ Build succeeds: `bun build`
✅ Type checking passes: `bun build:declaration`
✅ Biome check passes: `bun lint`
❌ Specific test failures: `bun test ./test/streaming.test.ts` (2 failures)

### Parser Review Findings

#### Matches Plan:
- Entry parser correctly handles malformed JSON with error recovery
- Fixing parser implements smart comma/quote/bracket fixes
- Coercers properly convert types to match Zod schemas
- Scoring system selects optimal types from unions
- Streaming parser handles partial JSON correctly

#### Deviations from Plan:
- Used different scoring weights in union_coercer.ts (performance optimization)
- Added extra error recovery for nested objects (improvement)
- Simplified value representation for better memory usage

#### Parser Architecture Compliance:
✅ Parser → Value → Deserializer → Coercer flow implemented
✅ All coercers follow consistent interface pattern
✅ Zod schemas properly integrated for validation
✅ Error recovery attempts appropriate fixes
❌ Missing coercer for custom type [type:line]

#### Performance Characteristics:
- Parsing 1MB JSON: ~50ms (target: <100ms) ✅
- Memory usage for large files: ~2x file size (acceptable)
- Streaming performance: 10MB/s throughput
- Error recovery overhead: ~10% slowdown (within tolerance)

### Manual Testing Required:
1. **Malformed JSON Testing**:
   - [ ] Test with real-world LLM outputs (GPT, Claude, etc.)
   - [ ] Verify recovery from missing commas: `{"a":1 "b":2}`
   - [ ] Test single quotes: `{'key': 'value'}`
   - [ ] Check comment handling: `{/* comment */ "key": "value"}`

2. **Mixed Content Testing**:
   - [ ] Extract JSON from markdown code blocks
   - [ ] Handle JSON within prose text
   - [ ] Test with multiple JSON objects in one string

3. **Edge Case Testing**:
   - [ ] Very deeply nested objects (100+ levels)
   - [ ] Large arrays (10k+ elements)
   - [ ] Unicode and special characters
   - [ ] Circular reference detection
   
4. **Parser Feature Examples**:
   ```typescript
   // Test malformed JSON recovery
   const result1 = parse(`{"name": "John" "age": 30}`); // missing comma
   const result2 = parse(`{'name': 'John'}`); // single quotes
   const result3 = parse(`{name: "John", age: 30,}`); // unquoted keys, trailing comma
   
   // Test mixed content extraction
   const result4 = parse(`
     Here's the data:
     \`\`\`json
     {"name": "John", "age": 30}
     \`\`\`
     That's all!
   `);
   
   // Test streaming
   const chunks = ['{"na', 'me": "Jo', 'hn", "ag', 'e": 30}'];
   const result5 = parseStreaming(chunks);
   ```

### Parser Feature Verification:
- [ ] Streaming parser handles chunks correctly
- [ ] Partial objects can be deserialized
- [ ] Union types resolve to most specific match
- [ ] Literal values coerce appropriately
- [ ] Enum values match case-insensitively

### Type Safety Review:
- [ ] All public APIs have proper TypeScript types
- [ ] Zod schemas match TypeScript interfaces
- [ ] Generic type parameters work correctly
- [ ] Type inference works for complex schemas

### Recommendations:
- Add benchmarks for performance regression testing
- Consider adding fuzzing tests for parser robustness
- Document error recovery strategies in detail
- Update CLAUDE.md with any new parser patterns
```

## Working with Existing Context

If you were part of the implementation:
- Review the conversation history for what was actually done
- Check your todo list (if any) for completed items
- Focus validation on work done in this session
- Be honest about any shortcuts or incomplete items
- Note any decisions that deviated from the plan and why

## JSONish-Specific Checks

Always verify parser patterns:

### Parser Flow Validation
Verify the complete parsing pipeline:
```
Input String → Parser → Value → Deserializer → Coercer → Output
```
- [ ] Each stage properly handles errors and passes them forward
- [ ] Type information flows correctly through the pipeline
- [ ] Performance bottlenecks identified at each stage

### Parser Layer
- [ ] Entry parser in `src/jsonish/parser/entry_parser.ts`
- [ ] Error recovery in `src/jsonish/parser/fixing-parser/`
- [ ] Value types in `src/jsonish/value.ts`
- [ ] Streaming support for partial JSON

### Deserializer Layer
- [ ] Main deserializer in `src/deserializer/deserializer.ts`
- [ ] Proper scoring logic in `src/deserializer/score.ts`
- [ ] Flags properly used from `src/deserializer/flags.ts`
- [ ] Error handling returns meaningful results

### Coercer Layer
- [ ] All coercers follow consistent interface
- [ ] Primitive coercer handles basic types
- [ ] Array coercer handles nested structures
- [ ] Map coercer handles object transformations
- [ ] Union coercer uses scoring for best match
- [ ] Literal coercer handles exact values
- [ ] IR ref coercers (alias, class, enum) work correctly

### Type Safety & Validation
- [ ] Zod schemas properly defined and used
- [ ] TypeScript types match runtime behavior
- [ ] Generic type parameters preserved
- [ ] Proper error types returned

## Important Guidelines

1. **Be thorough but practical** - Focus on what matters for correct parsing
2. **Run all automated checks** - Don't skip test suite or type checking
3. **Document everything** - Both successes and parsing edge cases
4. **Think critically** - Question if parser handles real-world JSON
5. **Consider performance** - Will this scale to large/streaming inputs?
6. **Test error recovery** - Ensure malformed JSON is handled gracefully

## Validation Checklist

Always verify:
- [ ] All phases marked complete are actually done
- [ ] Test suite passes (aim for 236+ tests)
- [ ] Build and type checking succeed
- [ ] Code follows parser architecture patterns
- [ ] No regressions in existing parsing behavior
- [ ] Error recovery works for common mistakes
- [ ] Performance meets benchmarks
- [ ] Edge cases are properly tested
- [ ] Zod integration works correctly

## Common Issues to Check

### Parser Issues
- Not handling malformed JSON correctly (missing commas, quotes)
- Streaming parser failing on chunk boundaries
- Error recovery too aggressive or not aggressive enough
- Mixed content extraction missing valid JSON

### Deserializer Issues
- Type coercion not matching Zod schema expectations
- Scoring system selecting wrong type from unions
- Partial objects not handled gracefully
- Circular references causing infinite loops

### Coercer Issues
- Primitive coercer not handling edge cases (null, undefined)
- Array coercer failing on deeply nested structures
- Map coercer not preserving key order when needed
- Union coercer score calculation incorrect

### Performance Issues
- Parser using excessive memory on large inputs
- Streaming not actually streaming (buffering entire input)
- Error recovery causing exponential slowdown
- Type inference taking too long on complex schemas

## Addenda:
Remember: Good validation ensures the parser handles real-world, messy JSON from LLMs and other sources. Be constructive but thorough in identifying gaps or improvements that enhance robustness and performance.