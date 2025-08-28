---
date: 2025-08-28T18:45:12-05:00
researcher: Claude
git_commit: 466a2e6abb00006634d62df657476aaa48465351
branch: master
repository: jsonish
topic: "Code Extraction and Parsing Implementation Strategy"
tags: [implementation, strategy, parser, deserializer, coercer, jsonish, code-extraction, quote-handling]
status: complete
last_updated: 2025-08-28
last_updated_by: Claude
type: implementation_strategy
---

# Code Extraction and Parsing Implementation Plan

## Overview

We need to implement comprehensive code extraction and parsing capabilities to handle 6 quote types (double, single, backticks, triple double, triple backticks, unquoted) with sophisticated string processing including dedentation, quote stripping, and mixed content extraction. This addresses 19 failing tests out of 35 code extraction tests, bringing the TypeScript implementation in line with the Rust parser's capabilities.

## Current State Analysis

The current TypeScript parser has solid architecture with a 6-strategy parsing pipeline but lacks critical code extraction features:

### Key Discoveries:
- **Multi-strategy parser** (`parser.ts:23-74`): Good foundation with 6 fallback strategies
- **Limited quote support** (`coercer.ts:385`): Only handles single/double quotes (`/^["']|["']$/g`)  
- **Basic triple quote handling** (`state-machine.ts:262-278`): Conversion but no dedentation
- **Incomplete markdown extraction** (`extractors.ts:61-106`): Only `json`/`javascript` language hints
- **Missing backtick tokenization**: Backticks treated as literal content throughout parser

### Test Failure Categories:
- **8 failures**: Backtick quote stripping (`` `content` `` → `content`)
- **2 failures**: Triple quote dedentation (whitespace removal)
- **4 failures**: Mixed content extraction (markdown code blocks)
- **3 failures**: Unescaped quote handling (nested quotes)
- **2 failures**: Large code block processing (backtick content)

## What We're NOT Doing

- Not reimplementing the entire parser architecture (current 6-strategy approach is solid)
- Not adding BAML-specific language features or DSL capabilities
- Not changing the Zod schema integration or type coercion foundations  
- Not modifying the core Value representation system in `value.ts`
- Not implementing performance optimizations beyond functional requirements

## Implementation Approach

We'll enhance the existing parser pipeline by adding comprehensive quote processing capabilities while preserving the current architecture. The strategy focuses on extending quote handling in the coercer, state machine, and extractors to support all 6 quote types with appropriate preprocessing (dedentation, stripping, etc.).

## Phase 1: Enhanced Quote Processing Foundation

### Overview
Implement comprehensive quote type recognition and processing in the core coercion system, establishing the foundation for all code extraction features.

### Changes Required:

#### 1. Quote Stripping Enhancement
**File**: `jsonish/src/coercer.ts`
**Changes**: Extend quote removal to handle all 6 quote types

```typescript
// Replace line 385 with comprehensive quote stripping
function stripQuotes(input: string): string {
  // Handle triple backticks first (longest pattern)
  if (input.startsWith('```') && input.endsWith('```') && input.length > 6) {
    return input.slice(3, -3);
  }
  
  // Handle triple quotes
  if (input.startsWith('"""') && input.endsWith('"""') && input.length > 6) {
    return input.slice(3, -3);
  }
  
  // Handle single backticks, single quotes, double quotes
  return input.replace(/^[`"']|[`"']$/g, '');
}
```

#### 2. Dedentation Utility Implementation
**File**: `jsonish/src/helpers/dedent.ts` (new)
**Changes**: Port Rust dedentation algorithm for triple-quoted content

```typescript
export interface DedentResult {
  content: string;
  indentSize: number;
}

export function dedent(input: string): DedentResult {
  const lines = input.split(/\r?\n/);
  
  // Skip leading empty lines
  let firstNonEmptyIndex = 0;
  while (firstNonEmptyIndex < lines.length && lines[firstNonEmptyIndex].trim() === '') {
    firstNonEmptyIndex++;
  }
  
  // Find common prefix among non-empty lines
  let commonPrefix = '';
  const nonEmptyLines = lines.slice(firstNonEmptyIndex).filter(line => line.trim() !== '');
  
  if (nonEmptyLines.length > 0) {
    // Implementation details...
  }
  
  return { content: processedContent, indentSize: commonPrefix.length };
}
```

#### 3. State Machine Quote Enhancement  
**File**: `jsonish/src/state-machine.ts`
**Changes**: Add backtick support to `parseString` function at line 256

```typescript
// Add backtick case to parseString function
if (quote === '`') {
  // Handle backtick strings with template literal logic
  // No escape sequence processing (unlike double/single quotes)
  return parseBacktickString(input, state);
}
```

### Success Criteria:

**Automated Verification**
- [ ] `bun run tests` passes all tests
- [ ] `bun build` completes without errors
- [ ] No TypeScript errors in modified files

**Manual Verification**
- [ ] Basic backtick stripping: `` `hello` `` → `hello`
- [ ] Triple quote dedentation: `"""\n  code\n"""` → `code`  
- [ ] Quote processing preserves content integrity
- [ ] No regressions in existing quote handling tests

## Phase 2: Mixed Content and Code Fence Extraction

### Overview
Enhance markdown extraction capabilities and implement sophisticated code block processing to handle complex mixed content scenarios.

### Changes Required:

#### 1. Enhanced Markdown Extractors
**File**: `jsonish/src/extractors.ts`
**Changes**: Improve regex patterns and add comprehensive language hint support

```typescript
// Replace lines 61-106 with enhanced patterns
const ENHANCED_CODE_BLOCK_PATTERNS = {
  // Complete blocks with language hints
  complete: /```(\w+)?\s*\n?([\s\S]*?)\n?```/g,
  
  // Incomplete blocks (streaming support) 
  incomplete: /```(\w+)?\s*\n?([\s\S]*)$/,
  
  // Single backticks for inline code
  inline: /`([^`\n]+)`/g,
  
  // Mixed content with JSON extraction
  jsonInText: /(?:```(?:json|javascript|js|typescript|ts)?\s*\n?)?\{[\s\S]*?\}(?:\s*```)?/g
};
```

#### 2. Code Block Processing Pipeline
**File**: `jsonish/src/extractors.ts`  
**Changes**: Add sophisticated content processing with dedentation

```typescript
function processCodeBlock(content: string, language?: string): Value {
  // Apply dedentation for multi-line content
  const { content: dedentedContent } = dedent(content);
  
  // Try JSON parsing first
  if (language === 'json' || !language) {
    try {
      return { type: 'object', value: JSON.parse(dedentedContent), completion: 'Complete' };
    } catch {
      // Fall back to state machine parsing
    }
  }
  
  // Return as string with completion state
  return { type: 'string', value: dedentedContent, completion: 'Complete' };
}
```

#### 3. Parser Pipeline Integration
**File**: `jsonish/src/parser.ts`
**Changes**: Add dedicated code extraction step between strategies 2-3 (line 76-106)

```typescript
// Add after mixed content extraction (around line 106)
if (opts.allowCodeExtraction !== false) {
  const codeExtracted = extractAdvancedCodeBlocks(input, schema);
  if (codeExtracted && codeExtracted.type !== 'string') {
    return codeExtracted;
  }
}
```

### Success Criteria:

**Automated Verification**
- [ ] `bun run tests` results in no new regressions
- [ ] Code extraction tests pass: tests 608, 711, 734, 753, 773
- [ ] Mixed content scenarios work correctly

**Manual Verification**  
- [ ] Markdown code blocks extract JSON correctly
- [ ] Language hints are processed properly
- [ ] Dedentation works for multi-line code blocks
- [ ] Streaming/incomplete blocks are handled gracefully

## Phase 3: Advanced Quote and Error Recovery

### Overview
Implement sophisticated quote balancing and error recovery to handle unescaped quotes, nested quote scenarios, and large code block processing.

### Changes Required:

#### 1. Smart Quote Balancing
**File**: `jsonish/src/state-machine.ts`
**Changes**: Enhance quote parsing with context-aware termination

```typescript
function parseStringWithBalancing(input: string, state: ParseState, outerQuote: string): ParseResult {
  // Track nested JSON structures for smart quote termination
  let bracketDepth = 0;
  let contextStack: string[] = [];
  
  // Allow unescaped quotes when they don't match outer quote type
  while (state.position < input.length) {
    if (char === outerQuote && bracketDepth === 0 && contextStack.length === 0) {
      // Safe to terminate - no nested contexts
      break;
    }
    // Context tracking logic...
  }
}
```

#### 2. Large Content Processing
**File**: `jsonish/src/coercer.ts`
**Changes**: Optimize string processing for large code blocks

```typescript
function processLargeContent(input: string): string {
  // Early detection of large content patterns
  if (input.length > 10000 && input.includes('```')) {
    return processCodeBlockContent(input);
  }
  
  // Standard processing for smaller content
  return stripQuotes(input);
}
```

#### 3. Error Recovery Enhancement
**File**: `jsonish/src/fixing-parser.ts` 
**Changes**: Add unescaped quote recovery patterns

```typescript
// Add after line 23 (existing triple quote handling)
export function fixUnescapedQuotes(input: string): string {
  // Handle unescaped double quotes in single quotes
  input = input.replace(/'([^']*)"([^']*)"([^']*)'/g, '"$1\\"$2\\"$3"');
  
  // Handle unescaped single quotes in double quotes  
  input = input.replace(/"([^"]*)'([^"]*)'([^"]*)"/g, '"$1\\\'$2\\\'$3"');
  
  return input;
}
```

### Success Criteria:

**Automated Verification**
- [ ] `bun run tests` passes all tests  
- [ ] All 19 failing code extraction tests now pass
- [ ] No regressions in existing test suite
- [ ] Performance remains acceptable for large inputs

**Manual Verification**
- [ ] Unescaped quote scenarios: `"print("hello")"` works correctly
- [ ] Large code blocks (>1000 chars) process without errors
- [ ] Mixed quote types don't interfere with each other
- [ ] Error recovery maintains data integrity

## Test Strategy

### Unit Tests
- [ ] Quote stripping tests in `test/code.test.ts` (tests 14-87)
- [ ] Dedentation tests for triple quotes (tests 96, 113)  
- [ ] Backtick processing tests (tests 154, 224, 286, 327, 516, 694)
- [ ] Mixed content extraction tests (tests 608, 711, 734, 753, 773)

### Integration Tests  
- [ ] End-to-end parsing with Zod schemas and code extraction
- [ ] Union type resolution with code content
- [ ] Streaming/partial code block handling
- [ ] Performance testing with large code blocks

### Edge Case Coverage
- [ ] Nested backticks and quotes
- [ ] Malformed code blocks (incomplete closing)
- [ ] Mixed language hints in same document
- [ ] Unicode content in code blocks

## Performance Considerations

**Parser Performance**: New quote processing adds minimal overhead as it reuses existing string traversal
**Coercion Overhead**: Quote stripping is O(1) for most cases, O(n) for dedentation (acceptable)  
**Memory Usage**: Dedentation creates new strings but releases originals (net neutral)
**Regex Performance**: Enhanced patterns are more complex but run only on potential code content

## Migration Notes

**Backward Compatibility**: All existing quote handling remains functional - new code only extends current capabilities
**Configuration**: No breaking changes to parser options or Zod schema integration
**Error Handling**: Enhanced error recovery maintains fallback behavior for unknown content types

## References 
* Original research: `specifications/13-code-extraction-parsing/research/research_2025-08-28_16-30-17_rust-typescript-code-extraction-analysis.md`
* Current parser implementation: `jsonish/src/parser.ts:23-74`
* String coercion system: `jsonish/src/coercer.ts:5-34`, `jsonish/src/coercer.ts:385`
* State machine parsing: `jsonish/src/state-machine.ts:256-333`
* Content extractors: `jsonish/src/extractors.ts:61-106`
* Test specifications: `test/code.test.ts:14-87` (quote handling), `test/code.test.ts:608-795` (triple backticks)
* Rust reference implementation: `baml/engine/baml-lib/jsonish/src/jsonish/parser/fixing_parser/json_parse_state.rs:724-778`
* Dedentation algorithm: `baml/engine/bstd/src/dedent.rs:6-68`