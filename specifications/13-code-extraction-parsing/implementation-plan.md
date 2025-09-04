---
date: 2025-09-03T16:45:00-08:00
researcher: Claude
git_commit: afc2d8d83104849c4053f5a2eaff44266c3804e1
branch: master
repository: jsonish
topic: "Code Extraction and Parsing Implementation Strategy"
tags: [implementation, strategy, parser, deserializer, coercer, jsonish, code-blocks, quote-handling]
status: complete
last_updated: 2025-09-03
last_updated_by: Claude
type: implementation_strategy
---

# Code Extraction and Parsing Implementation Plan

## Overview

This document outlines the implementation strategy for JSONish's comprehensive code extraction and parsing capabilities. The feature enables parsing of JSON structures containing code blocks, multiple quote types, and complex string patterns commonly found in LLM outputs and development workflows.

The implementation follows the proven architecture from the original BAML Rust implementation, using a sophisticated two-phase approach: parser-level quote recognition and coercer-level content processing.

## Current State Analysis

### Key Discoveries:

- **Sophisticated existing architecture** with multi-strategy parsing pipeline in `src/parser.ts:23-74`
- **Advanced string coercion system** with layered matching in `src/coercer.ts:374-411`
- **Basic triple quote support** in `src/state-machine.ts:262-278` but missing dedentation
- **Limited quote stripping** in `src/coercer.ts:385` using `/^["']|["']$/g` pattern
- **Missing backtick support** throughout the parsing pipeline (root cause of 8 test failures)

### Test Failure Analysis:

Of 139 total tests, 19 are currently failing:
- **8 failures**: Backtick quote stripping (no backtick recognition in parser)
- **3 failures**: Triple quote dedentation (missing sophisticated whitespace removal)
- **4 failures**: Complex code fence extraction (insufficient regex patterns)
- **4 failures**: Unescaped quote handling (context-unaware termination logic)

## What We're NOT Doing

- Adding BAML-specific language features or DSL functionality
- Creating new parser strategies (leveraging existing multi-strategy pipeline)
- Breaking backward compatibility with existing JSONish parsing
- Implementing non-essential language hints beyond basic markdown support
- Adding performance-heavy features that would slow down basic JSON parsing

## Implementation Approach

Following the BAML Rust architecture, we'll implement a **two-phase quote processing system**:

1. **Parser Phase**: Recognize all 6 quote types in state machine and fixing parser
2. **Coercer Phase**: Apply quote-specific content transformations during string processing

This approach provides context-aware parsing while centralizing content processing logic for maintainability.

## Phase 1: Core Quote Processing Enhancement

### Overview
Establish comprehensive quote recognition and basic content processing for all 6 quote types supported by JSONish.

### Changes Required:

#### 1. Enhanced Quote Recognition (State Machine)
**File**: `src/jsonish/parser/state-machine.ts`
**Changes**: Extend `parseString()` function to recognize backticks alongside existing quote types

**Current Logic** (lines 256-333):
```typescript
// Only handles double and single quotes
if (char === '"' || char === "'") {
```

**Enhanced Logic**:
```typescript
// Handle all quote types including backticks
if (char === '"' || char === "'" || char === '`') {
  return parseQuotedString(input, state, char);
}

// Enhanced triple quote detection
if (input.slice(state.position - 1, state.position + 2) === char.repeat(3)) {
  return parseTripleQuotedString(input, state, char);
}
```

#### 2. Backtick Support in Fixing Parser
**File**: `src/jsonish/parser/fixing-parser.ts`
**Changes**: Add backtick normalization alongside existing triple quote handling

**Current Triple Quote Fix** (lines 28-31):
```typescript
// Handle triple-quoted strings: """content""" → "content"
fixed = fixed.replace(/"""([\s\S]*?)"""/g, (match, content) => {
  return `"${content.replace(/"/g, '\\"')}"`;
});
```

**Enhanced Quote Fixing**:
```typescript
// Handle backtick strings: `content` → "content"
fixed = fixed.replace(/`([^`]*)`/g, (match, content) => {
  return `"${content.replace(/"/g, '\\"')}"`;
});

// Handle triple backticks: ```content``` → "content"
fixed = fixed.replace(/```([\s\S]*?)```/g, (match, content) => {
  const cleanContent = content.split('\n').slice(1).join('\n'); // Remove first line (language hint)
  return `"${dedent(cleanContent).replace(/"/g, '\\"')}"`;
});
```

#### 3. Advanced Quote Stripping (Coercer)
**File**: `src/coercer.ts`
**Changes**: Enhance quote stripping to handle all quote types with context-aware processing

**Current Implementation** (line 385):
```typescript
const cleanInput = input.replace(/^["']|["']$/g, '');
```

**Enhanced Implementation**:
```typescript
function stripQuotes(input: string): { content: string; quoteType: 'double' | 'single' | 'backtick' | 'triple' | 'triple-backtick' | 'none' } {
  const trimmed = input.trim();
  
  // Triple backticks (highest priority - longest pattern)
  if (trimmed.startsWith('```') && trimmed.endsWith('```') && trimmed.length > 6) {
    const content = trimmed.slice(3, -3);
    const lines = content.split('\n');
    const cleanContent = lines.length > 1 ? lines.slice(1).join('\n') : content; // Remove language hint
    return { content: dedent(cleanContent), quoteType: 'triple-backtick' };
  }
  
  // Triple quotes
  if ((trimmed.startsWith('"""') && trimmed.endsWith('"""')) || 
      (trimmed.startsWith("'''") && trimmed.endsWith("'''"))) {
    const content = trimmed.slice(3, -3);
    return { content: dedent(content), quoteType: 'triple' };
  }
  
  // Backticks
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 2) {
    return { content: trimmed.slice(1, -1), quoteType: 'backtick' };
  }
  
  // Single/double quotes (existing logic)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return { content: trimmed.slice(1, -1), quoteType: trimmed[0] === '"' ? 'double' : 'single' };
  }
  
  return { content: input, quoteType: 'none' };
}
```

#### 4. Dedentation Utility Implementation
**File**: `src/helpers/dedent.ts` (new file)
**Changes**: Port the sophisticated BAML dedentation algorithm

```typescript
interface DedentResult {
  content: string;
  indentSize: number;
}

export function dedent(input: string): string {
  const result = dedentWithInfo(input);
  return result.content;
}

export function dedentWithInfo(input: string): DedentResult {
  if (!input) return { content: '', indentSize: 0 };
  
  const lines = input.split('\n');
  
  // Find first non-empty line to establish indent pattern
  let firstNonEmptyIndex = 0;
  while (firstNonEmptyIndex < lines.length && lines[firstNonEmptyIndex].trim() === '') {
    firstNonEmptyIndex++;
  }
  
  if (firstNonEmptyIndex >= lines.length) {
    return { content: input, indentSize: 0 }; // All empty lines
  }
  
  // Extract prefix from first non-empty line
  const firstLine = lines[firstNonEmptyIndex];
  let commonPrefix = firstLine.match(/^[ \t]*/)?.[0] || '';
  
  // Refine prefix by checking all subsequent non-empty lines
  for (let i = firstNonEmptyIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue; // Skip empty lines
    
    const linePrefix = line.match(/^[ \t]*/)?.[0] || '';
    
    // Find common prefix between current and existing
    let j = 0;
    while (j < Math.min(commonPrefix.length, linePrefix.length) && 
           commonPrefix[j] === linePrefix[j]) {
      j++;
    }
    commonPrefix = commonPrefix.slice(0, j);
    
    if (commonPrefix === '') break; // No common indentation
  }
  
  // Apply prefix removal
  const dedentedLines = lines.map(line => 
    line.length > commonPrefix.length && line.startsWith(commonPrefix)
      ? line.slice(commonPrefix.length)
      : line
  );
  
  // Preserve original trailing newline semantics
  const hadTrailingNewline = input.endsWith('\n');
  let result = dedentedLines.join('\n');
  
  if (!hadTrailingNewline && result.endsWith('\n')) {
    result = result.slice(0, -1);
  }
  
  return { 
    content: result,
    indentSize: commonPrefix.length
  };
}
```

### Success Criteria:

**Automated verification**
- [ ] `bun run tests` passes all tests
- [ ] `bun build` completes without errors  
- [ ] No TypeScript errors from new code
- [ ] Backtick quote stripping tests pass (8 previously failing tests)

**Manual Verification**
- [ ] Basic backtick strings: `{"code": \`print("hello")\`}` → `{code: 'print("hello")'}`
- [ ] Triple quotes with indentation get dedented properly
- [ ] No regressions in existing string parsing functionality
- [ ] Quote stripping preserves content integrity

## Phase 2: Enhanced Code Block Extraction

### Overview
Improve markdown code fence extraction and mixed content parsing for complex scenarios found in LLM outputs.

### Changes Required:

#### 1. Enhanced Markdown Extractors
**File**: `src/jsonish/parser/extractors.ts`
**Changes**: Improve regex patterns and add language hint processing

**Current Implementation** (lines 57-106):
```typescript
const completeRegex = /```(?:json|javascript)?\s*\n?([\s\S]*?)\n?```/g;
```

**Enhanced Implementation**:
```typescript
// More comprehensive language detection
const completeRegex = /```(?:json|javascript|js|typescript|ts|python|py)?\s*\n?([\s\S]*?)\n?```/g;

// Enhanced nested code block handling
const nestedCodeRegex = /```[\s\S]*?```/g;

function extractFromMarkdown(text: string): string[] {
  const codeBlocks: string[] = [];
  
  // Extract all complete code blocks
  let match;
  while ((match = completeRegex.exec(text)) !== null) {
    const content = match[1].trim();
    if (content) {
      codeBlocks.push(content);
    }
  }
  
  // Handle incomplete blocks (streaming scenario)
  const incompleteMatch = text.match(/```(?:json|javascript|js|typescript|ts|python|py)?\s*\n?([\s\S]*)$/);
  if (incompleteMatch && incompleteMatch[1].trim()) {
    codeBlocks.push(incompleteMatch[1].trim());
  }
  
  return codeBlocks;
}
```

#### 2. Multi-JSON Object Parsing
**File**: `src/jsonish/parser/parser.ts`
**Changes**: Add multi-JSON extraction strategy between markdown and fixing parser

**Enhanced Parser Strategy** (insert after line 74):
```typescript
// Strategy 3: Multi-JSON object extraction
if (!context?.disableMultiJson) {
  try {
    const multiJsonResult = parseMultipleJsonObjects(text);
    if (multiJsonResult.success) {
      return coerceToSchema(multiJsonResult.value, schema, { ...context, isFromFixing: true });
    }
  } catch (error) {
    // Continue to next strategy
  }
}
```

**New Multi-JSON Function**:
```typescript
function parseMultipleJsonObjects(text: string): { success: boolean; value: any } {
  const jsonObjects: any[] = [];
  let braceDepth = 0;
  let currentObject = '';
  let inQuotes = false;
  let quoteChar = '';
  let escaped = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (escaped) {
      currentObject += char;
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      currentObject += char;
      continue;
    }
    
    if (inQuotes) {
      currentObject += char;
      if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      }
      continue;
    }
    
    if (char === '"' || char === "'" || char === '`') {
      inQuotes = true;
      quoteChar = char;
      currentObject += char;
      continue;
    }
    
    if (char === '{') {
      braceDepth++;
      currentObject += char;
    } else if (char === '}') {
      braceDepth--;
      currentObject += char;
      
      if (braceDepth === 0 && currentObject.trim()) {
        try {
          const parsed = JSON.parse(currentObject.trim());
          jsonObjects.push(parsed);
          currentObject = '';
        } catch {
          // Continue accumulating if not valid JSON yet
        }
      }
    } else {
      currentObject += char;
    }
  }
  
  if (jsonObjects.length === 1) {
    return { success: true, value: jsonObjects[0] };
  } else if (jsonObjects.length > 1) {
    return { success: true, value: jsonObjects };
  }
  
  return { success: false, value: null };
}
```

#### 3. Context-Aware Quote Termination
**File**: `src/jsonish/parser/state-machine.ts`
**Changes**: Add intelligent quote balancing for unescaped quotes

**Enhanced String Termination Logic**:
```typescript
function shouldCloseString(input: string, position: number, quoteChar: string, context: ParseContext): boolean {
  // Look ahead to see if this quote makes sense as terminator
  const remaining = input.slice(position + 1);
  const lookahead = remaining.slice(0, 20); // Check next 20 chars
  
  // If we see JSON structure after this quote, it's likely a terminator
  if (/^\s*[,}\]:]/.test(lookahead)) {
    return true;
  }
  
  // If we see another quote of the same type soon, this might be content
  const nextSameQuote = remaining.indexOf(quoteChar);
  if (nextSameQuote !== -1 && nextSameQuote < 50) {
    // Check if there's balanced structure between quotes
    const between = remaining.slice(0, nextSameQuote);
    const openBraces = (between.match(/[({[]/g) || []).length;
    const closeBraces = (between.match(/[)}\]]/g) || []).length;
    
    if (openBraces === closeBraces) {
      return false; // Likely content quote, not terminator
    }
  }
  
  return true; // Default to closing
}
```

### Success Criteria:

**Automated verification**
- [ ] `bun run tests` passes all tests
- [ ] Triple backtick extraction tests pass (4 previously failing tests)  
- [ ] Complex code fence scenarios handle nested content
- [ ] Multi-JSON object parsing works correctly

**Manual Verification**
- [ ] Markdown code blocks extract JSON correctly from mixed content
- [ ] Multiple JSON objects in single input parse as array
- [ ] Language hints are properly removed from code blocks
- [ ] Nested code structures don't break parsing

## Phase 3: Advanced Error Recovery and Edge Cases

### Overview
Implement sophisticated error recovery for malformed code blocks and handle streaming/partial content scenarios.

### Changes Required:

#### 1. Advanced Unescaped Quote Handling
**File**: `src/jsonish/parser/state-machine.ts`
**Changes**: Implement context-aware quote balancing for mixed quote scenarios

**Enhanced Quote Context Handling**:
```typescript
function handleMixedQuotes(input: string, state: ParseState): ParseResult {
  const { position, quoteChar } = state;
  let depth = 0;
  let content = '';
  let i = position;
  
  while (i < input.length) {
    const char = input[i];
    
    if (char === quoteChar) {
      // Check if this quote is escaped by context
      if (isEscapedByContext(input, i, quoteChar)) {
        content += char;
        i++;
        continue;
      }
      
      // Use lookahead to determine if this should close the string
      if (shouldCloseString(input, i, quoteChar, { depth, content })) {
        return {
          value: createStringValue(content),
          position: i + 1,
          fixes: ['Handled unescaped quotes in content']
        };
      }
    }
    
    // Track bracket depth for context
    if (char === '(' || char === '[' || char === '{') depth++;
    if (char === ')' || char === ']' || char === '}') depth--;
    
    content += char;
    i++;
  }
  
  // Unclosed string - return what we have
  return {
    value: createStringValue(content, CompletionState.Incomplete),
    position: i,
    fixes: ['Auto-closed unclosed string with mixed quotes']
  };
}

function isEscapedByContext(input: string, position: number, quoteChar: string): boolean {
  // Check for programming language contexts where quotes should be preserved
  const before = input.slice(Math.max(0, position - 10), position);
  const after = input.slice(position + 1, position + 11);
  
  // Common patterns where quotes should be preserved
  const preservePatterns = [
    /print\s*\(\s*$/, // print("
    /console\.log\s*\(\s*$/, // console.log("
    /\$\{\s*$/, // Template literal interpolation
    /=\s*$/ // Assignment
  ];
  
  return preservePatterns.some(pattern => pattern.test(before));
}
```

#### 2. Large Code Block Optimization
**File**: `src/jsonish/parser/state-machine.ts`
**Changes**: Optimize parsing for large code blocks without sacrificing accuracy

**Streaming Buffer Management**:
```typescript
function parseStringStreamOptimized(input: string, state: ParseState): ParseResult {
  const { position, quoteChar } = state;
  
  // For large inputs, use chunked processing
  if (input.length - position > 10000) {
    return parseStringChunked(input, state, 1000);
  }
  
  return parseString(input, state);
}

function parseStringChunked(input: string, state: ParseState, chunkSize: number): ParseResult {
  const { position, quoteChar } = state;
  let currentPos = position;
  let content = '';
  
  while (currentPos < input.length) {
    const chunkEnd = Math.min(currentPos + chunkSize, input.length);
    const chunk = input.slice(currentPos, chunkEnd);
    
    // Process chunk looking for termination
    const termIndex = findStringTermination(chunk, quoteChar);
    if (termIndex !== -1) {
      content += chunk.slice(0, termIndex);
      return {
        value: createStringValue(content),
        position: currentPos + termIndex + 1,
        fixes: ['Processed large code block in chunks']
      };
    }
    
    content += chunk;
    currentPos = chunkEnd;
  }
  
  // Reached end without termination
  return {
    value: createStringValue(content, CompletionState.Incomplete),
    position: currentPos,
    fixes: ['Large code block incomplete']
  };
}
```

#### 3. Completion State Enhancement
**File**: `src/jsonish/value.ts`
**Changes**: Add completion state propagation for complex parsing scenarios

**Enhanced Completion Tracking**:
```typescript
export function completeValueDeeply(value: Value): Value {
  if (value.type === 'string' && value.completion === CompletionState.Incomplete) {
    // For code strings, attempt completion based on content patterns
    const content = value.value;
    if (seemsLikeCompleteCode(content)) {
      return { ...value, completion: CompletionState.Complete };
    }
  }
  
  if (value.type === 'object') {
    const completedFields: Record<string, Value> = {};
    let allComplete = true;
    
    for (const [key, fieldValue] of Object.entries(value.value)) {
      const completed = completeValueDeeply(fieldValue);
      completedFields[key] = completed;
      if (completed.completion === CompletionState.Incomplete) {
        allComplete = false;
      }
    }
    
    return {
      ...value,
      value: completedFields,
      completion: allComplete ? CompletionState.Complete : CompletionState.Incomplete
    };
  }
  
  return value;
}

function seemsLikeCompleteCode(content: string): boolean {
  // Heuristics for complete code blocks
  const trimmed = content.trim();
  
  // Has balanced braces/brackets/parens
  if (!hasBalancedDelimiters(trimmed)) return false;
  
  // Doesn't end mid-statement
  if (trimmed.endsWith(',') || trimmed.endsWith('(') || trimmed.endsWith('{')) return false;
  
  // Common completion patterns
  const completePatterns = [
    /;\s*$/, // Ends with semicolon
    /}\s*$/, // Ends with closing brace
    /"\s*$/, // Ends with closing quote
    /\)\s*$/ // Ends with closing paren
  ];
  
  return completePatterns.some(pattern => pattern.test(trimmed));
}
```

### Success Criteria:

**Automated verification**
- [ ] `bun run tests` passes all tests
- [ ] Unescaped quote handling tests pass (3 previously failing tests)
- [ ] Large code block tests pass (2 previously failing tests)
- [ ] No performance regressions with enhanced error recovery

**Manual Verification**
- [ ] Mixed quote scenarios like `"print("Hello")"` parse correctly
- [ ] Large code blocks (1000+ characters) parse efficiently
- [ ] Streaming/incomplete code blocks handle gracefully
- [ ] Error recovery doesn't break valid JSON parsing

## Test Strategy

### Unit Tests
- [ ] **Quote stripping tests** in `test/code.test.ts:14-87` - All 5 quote handling tests pass
- [ ] **Dedentation tests** for triple quote content processing
- [ ] **Backtick recognition** in state machine and fixing parser
- [ ] **Multi-JSON extraction** with various bracket scenarios

### Integration Tests
- [ ] **End-to-end parsing** with all 6 quote types against Zod schemas
- [ ] **Complex code fence scenarios** from `test/code.test.ts:608-795` - All 9 triple backtick tests pass
- [ ] **Mixed content extraction** with markdown and JSON interleaved
- [ ] **Large content performance** with 50+ line code blocks

### Edge Case Coverage
- [ ] **Empty code blocks** and whitespace-only content
- [ ] **Unicode characters** in code strings (international text, emojis)
- [ ] **Nested quote scenarios** with multiple levels of quote mixing
- [ ] **Streaming scenarios** with incomplete code blocks

## Performance Considerations

### Parser Performance
- **Quote recognition overhead**: Minimal impact as backtick check adds single character comparison
- **Dedentation processing**: Only applied to triple-quoted content, won't affect standard JSON
- **Multi-strategy pipeline**: Existing architecture already optimized for fallback processing

### Memory Management
- **Large code blocks**: Chunked processing prevents memory spikes for substantial content
- **String preprocessing**: Quote stripping creates temporary strings but releases quickly
- **Completion state tracking**: Minimal overhead for state management

### Parsing Speed
- **Context-aware termination**: Lookahead logic bounded to 50 characters maximum
- **Regex optimization**: Code fence patterns compiled once and reused
- **Early termination**: Standard JSON parsing still takes priority path for valid JSON

## Migration Notes

### Breaking Changes
- **None expected**: All enhancements are additive to existing parser capabilities
- **Quote stripping**: Enhanced behavior maintains backward compatibility
- **Error recovery**: More lenient parsing should not break existing valid inputs

### Configuration Options
- **Existing flags preserved**: All current parsing options continue to work
- **New capabilities**: Enhanced quote handling enabled by default
- **Fallback behavior**: Graceful degradation maintains existing error handling patterns

## References

* **Original requirements**: `specifications/13-code-extraction-parsing/feature.md`
* **BAML architecture research**: `specifications/13-code-extraction-parsing/research/research_2025-08-28_16-30-17_rust-typescript-code-extraction-analysis.md`
* **Test specifications**: `test/code.test.ts` (139 comprehensive test cases)
* **Rust implementation reference**: `baml/engine/baml-lib/jsonish/src/jsonish/parser/fixing_parser/json_parse_state.rs:724-778`
* **Dedentation algorithm**: `baml/engine/bstd/src/dedent.rs:6-68`
* **Quote processing patterns**: `baml/engine/baml-lib/jsonish/src/jsonish/parser/json_collection.rs:68-126`

This implementation plan provides a comprehensive roadmap for adding sophisticated code extraction and parsing capabilities to JSONish while maintaining the robust, performant architecture that makes it suitable for parsing malformed JSON from LLM outputs.