# Commit Changes

You are tasked with creating git commits for the changes made during this session.

## Process:

1. **Think about what changed:**
   - Review the conversation history and understand what was accomplished
   - Run `git status` to see current changes
   - Run `git diff` to understand the modifications
   - Consider whether changes should be one commit or multiple logical commits

2. **Plan your commit(s):**
   - Identify which files belong together
   - Draft clear, descriptive commit messages
   - Use imperative mood in commit messages
   - Focus on why the changes were made, not just what

3. **Present your plan to the user:**
   - List the files you plan to add for each commit
   - Show the commit message(s) you'll use
   - Ask: "I plan to create [N] commit(s) with these changes. Shall I proceed?"

4. **Execute upon confirmation:**
   - Use `git add` with specific files (never use `-A` or `.`)
   - Create commits with your planned messages
   - Show the result with `git log --oneline -n [number]`

## Git Workflow Notes:

- Main branch: `master` (not `main`)
- Always check for untracked files in `.claude/` directory
- Be mindful of debug files (e.g., `debug_*.ts`) - these are usually temporary
- Common directories to watch:
  - `src/` - Source code changes
  - `test/` - Test file changes
  - `specifications/` - Specification documents
  - `.claude/` - Claude-specific configuration

## JSONish Library Context:

JSONish is a TypeScript library that provides a robust, schema-aware JSON parser capable of handling malformed JSON and mixed content. Common areas of change include:

- **Parser Logic**: `src/jsonish/parser/` - Core parsing functionality and error recovery
  - `entry_parser.ts` - Main parser entry point
  - `fixing-parser/` - Error recovery mechanisms
- **Deserializer System**: `src/deserializer/` - Type coercion and schema validation
  - `deserializer.ts` - Main deserializer implementation
  - `score.ts` - Type matching score system
  - `flags.ts` - Parsing flags and options
- **Coercers**: `src/deserializer/coercer/` - Type-specific conversion logic
  - `array_coercer.ts`, `literal_coercer.ts`, `map_coercer.ts`, `primitive_coercer.ts`, `union_coercer.ts`
  - `ir_ref/` - Internal representations (alias, class, enum)
- **Tests**: `test/` - Test cases covering parsing scenarios (236+ tests)
  - `basics.test.ts` - Fundamental parsing tests
  - `class-*.test.ts` - Object/class parsing scenarios
  - `enum.test.ts`, `unions.test.ts`, `streaming.test.ts`, `partials.test.ts`
- **Utilities**: `src/helpers/` - Helper functions and utilities
- **Value Types**: `src/jsonish/value.ts` - Internal value representation

## Development Commands:

- `bun test` - Run the full test suite (236+ tests)
- `bun test ./test/basics.test.ts` - Run specific test file
- `bun test --watch` - Run tests in watch mode during development
- `bun build` - Build the TypeScript project
- `bun build:declaration` - Type check through build process
- `bun install` - Install dependencies
- Format/lint is handled by Biome (4-space indentation, single quotes, 120 char width)

## Pre-commit Checks:

Before committing, ensure:
- All tests pass: `bun test`
- Build succeeds: `bun build`
- No TypeScript errors: `bun build:declaration`

## Commit Categories:

Use **Conventional Commits** format appropriate for a parsing library:
- `feat(parser): ...` - New parsing features or capabilities
- `feat(deserializer): ...` - New type coercion or deserialization features
- `feat(coercer): ...` - New coercer implementations
- `fix(parser): ...` - Parser bug fixes or error recovery improvements
- `fix(coercer): ...` - Type coercion fixes
- `fix(deserializer): ...` - Deserialization logic fixes
- `test: ...` - Test additions or modifications
- `refactor: ...` - Code restructuring without functional changes
- `perf: ...` - Performance improvements
- `docs: ...` - Documentation updates (README.md, CLAUDE.md)
- `build: ...` - Build system, Bun configuration, or dependency changes
- `chore: ...` - Maintenance tasks, project structure updates

## Common Commit Scenarios:

### Adding a New Coercer:
- Include both the coercer implementation and its tests
- Example: `feat(coercer): add date coercer with ISO 8601 support`

### Fixing Parser Issues:
- Include the fix and any new test cases that verify it
- Example: `fix(parser): handle nested arrays with trailing commas`

### Improving Error Recovery:
- Group error recovery logic with related parser changes
- Example: `feat(parser): improve recovery for unclosed objects in streaming mode`

### Performance Improvements:
- Include benchmarks or performance test results in commit message
- Example: `perf(deserializer): optimize union type scoring (30% faster)`

## Remember:
- You have the full context of what was done in this session
- Group related changes together (e.g., parser logic + corresponding tests)
- Keep commits focused and atomic when possible
- The user trusts your judgment - they asked you to commit. don't present a commit plan, just do it.
- Never include claude attribution in commit messages, and never add attribution to yourself or co-author credit.
- This is a TypeScript port of BAML's Rust-based JSONish parser
- Uses Zod for schema validation and type definitions
- Test coverage is critical - ensure new features include tests
