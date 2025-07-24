# Debug

You are tasked with helping debug issues during development and testing of the JSONish TypeScript library. This command allows you to investigate parser failures, type coercion issues, test failures, and build errors without editing files. Think of this as a way to bootstrap a debugging session without using the primary window's context.

## Initial Response

When invoked WITH a plan/ticket file:
```
I'll help debug issues with [file name]. Let me understand the current state.

What specific problem are you encountering?
- What parser/deserializer feature were you implementing?
- Which test is failing or what JSON is not parsing correctly?
- Any error messages from tests or TypeScript?

I'll investigate test output, parser behavior, and recent changes to help figure out what's happening.
```

When invoked WITHOUT parameters:
```
I'll help debug your JSONish parser issue.

Please describe what's going wrong:
- Is it a parsing error, type coercion failure, or test failure?
- What JSON input is causing problems?
- What's the expected vs actual output?

I can investigate test failures, parser traces, TypeScript errors, and recent changes to help identify the issue.
```

## Environment Information

You have access to these key locations and tools:

**Test Output**:
- Run all tests: `bun test`
- Run specific test: `bun test ./test/basics.test.ts`
- Run test with filter: `bun test -t "parses simple object"`
- Test files: `test/` directory (236+ test cases)
- Watch mode: `bun test --watch`

**Build & TypeScript**:
- Build: `bun run build`
- Type check: `bun run build:declaration`
- TypeScript config: `tsconfig.json`
- Build output: `dist/` directory

**Parser Components**:
- Entry parser: `src/jsonish/parser/entry_parser.ts`
- Fixing parser: `src/jsonish/parser/fixing-parser/`
- Value types: `src/jsonish/value.ts`
- Deserializer: `src/deserializer/deserializer.ts`
- Coercers: `src/deserializer/coercer/`

**Common Test Categories**:
- Basic parsing: `test/basics.test.ts`
- Class/object parsing: `test/class-*.test.ts`
- Enum handling: `test/enum.test.ts`
- Union types: `test/unions.test.ts`
- Streaming: `test/streaming.test.ts`
- Partial parsing: `test/partials.test.ts`

## Process Steps

### Step 1: Understand the Problem

After the user describes the issue:

1. **Read any provided context** (plan or ticket file):
   - Understand what parser feature they're implementing
   - Note which test case or JSON input is problematic
   - Identify expected vs actual behavior

2. **Quick state check**:
   - Current git branch and recent commits
   - Any uncommitted changes to parser/deserializer
   - Which tests were passing before

### Step 2: Investigate the Issue

Spawn parallel Task agents for efficient investigation:

```
Task 1 - Run Failing Tests:
Investigate test failures and gather detailed output:
1. Run the specific failing test with verbose output
2. Check if related tests in the same file are passing
3. Look for test pattern (e.g., all union tests failing?)
4. Capture the exact error message and stack trace
5. Note any TypeScript compilation errors
Return: Test output with error details and patterns
```

```
Task 2 - Parser Flow Analysis:
Trace the parsing flow for the problematic input:
1. Check entry_parser.ts for the initial parsing logic
2. Look at fixing-parser for error recovery attempts
3. Examine value.ts for how the parsed value is represented
4. Check deserializer.ts for type coercion logic
5. Review relevant coercer (array, union, primitive, etc.)
Return: Which component is likely failing and why
```

```
Task 3 - Git and Recent Changes:
Understand what changed recently:
1. Check git status for uncommitted parser changes
2. Look at recent commits: git log --oneline -10 -- src/
3. Check if any test files were modified
4. Look for changes to package.json or tsconfig.json
5. Verify all imports are correct
Return: Recent changes that could affect parser behavior
```

### Step 3: Present Findings

Based on the investigation, present a focused debug report:

```markdown
## Debug Report: JSONish Parser Issue

### What's Wrong
[Clear statement of the parser/test issue based on evidence]

### Evidence Found

**Test Failure**:
```
$ bun test ./test/[failing-test].test.ts -t "[test name]"
[Actual error output with line numbers]
```

**Parser Flow**:
- Input JSON: `[problematic JSON]`
- Parser stage: [entry_parser | fixing-parser | deserializer | coercer]
- Failure point: [specific function/line]

**Type/Schema Issue** (if applicable):
```typescript
// Expected schema
const schema = z.object({ ... })

// Actual parsed value
{ ... }
```

### Root Cause Analysis

Based on the evidence, the issue appears to be:
- [ ] Parser not handling malformed JSON correctly
- [ ] Type coercion failing in deserializer
- [ ] Score calculation incorrect for union types
- [ ] Error recovery in fixing-parser not working
- [ ] Schema mismatch between test and implementation

### Debugging Steps

1. **Isolate the Parser Stage**:
   ```typescript
   // Test just the parser without deserializer
   import { parseJsonish } from './src/jsonish/parser/entry_parser'
   const result = parseJsonish('your json here')
   console.log(result)
   ```

2. **Check Type Coercion**:
   ```typescript
   // Test deserializer with known good Value
   import { deserialize } from './src/deserializer/deserializer'
   const value = /* create test Value */
   const result = deserialize(value, schema)
   ```

3. **Enable Debug Logging** (if implemented):
   ```bash
   DEBUG=jsonish:* bun test ./test/failing.test.ts
   ```

### Next Steps

1. **Quick Fix Attempts**:
   - Check if the test expectation is correct
   - Verify the schema matches the expected output
   - Look for missing comma/quote handling in fixing-parser

2. **If Parser Issue**:
   - Add console.log in entry_parser.ts at parse points
   - Check if fixing-parser rules cover this case
   - Verify Value construction is correct

3. **If Coercer Issue**:
   - Check the specific coercer for the failing type
   - Verify score calculation for unions
   - Test with simpler schema to isolate issue

Would you like me to investigate a specific parser component further?
```

## Parser-Specific Debugging

### Common Parser Issues

**1. Malformed JSON Not Fixed**:
```bash
# Test the fixing-parser directly
bun test ./test/basics.test.ts -t "missing comma"
```

**2. Type Coercion Failures**:
```bash
# Run union type tests
bun test ./test/unions.test.ts

# Run specific coercer tests
bun test -t "coerces string to number"
```

**3. Streaming/Partial JSON**:
```bash
# Test incomplete JSON handling
bun test ./test/streaming.test.ts
bun test ./test/partials.test.ts
```

### Debug Commands

**Run Specific Test Cases**:
```bash
# Run single test by name
bun test -t "parses object with trailing comma"

# Run all tests in a file
bun test ./test/class-baml-map.test.ts

# Run tests matching pattern
bun test -t "enum"
```

**Check Parser Output**:
```bash
# Create minimal test file
echo 'import { parseJsonish } from "./src/jsonish/parser/entry_parser"
console.log(parseJsonish("{invalid: json,}"))' > debug_parser.ts
bun run debug_parser.ts
```

**Type Checking**:
```bash
# Check for TypeScript errors
bun run build:declaration

# Check specific file
bunx tsc --noEmit src/deserializer/deserializer.ts
```

## Important Notes

- **Focus on parser flow** - Understand where in the pipeline the issue occurs
- **Test isolation** - Run smallest possible test case to reproduce
- **No file editing** - Pure investigation and analysis only
- **Check test expectations** - Sometimes the test itself has wrong expectations
- **Use Bun's test features** - Leverage -t flag for targeted testing

## Quick Reference

**Test Commands**:
```bash
bun test                        # Run all tests
bun test -t "test name"        # Run specific test
bun test ./test/file.test.ts   # Run specific file
bun test --watch               # Watch mode
```

**Parser Flow**:
```
JSON Input → entry_parser → fixing-parser (if needed) → Value → deserializer → coercers → Output
```

**Common File Locations**:
```bash
src/jsonish/parser/entry_parser.ts    # Main parser entry
src/jsonish/parser/fixing-parser/     # Error recovery
src/deserializer/deserializer.ts      # Type coercion entry
src/deserializer/coercer/             # Type-specific coercers
test/*.test.ts                        # All test files
```

Remember: This command helps you investigate parser issues without burning the primary window's context. Perfect for when a test fails or JSON doesn't parse as expected during implementation.