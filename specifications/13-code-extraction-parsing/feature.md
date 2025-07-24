---
date: 2025-01-24T00:00:00-08:00
researcher: Claude Code
git_commit: 4e974c5db60f8c7dd723a17d38948bae5afc488f
branch: master
repository: jsonish
topic: "Code Extraction and Parsing"
tags: [code-blocks, string-handling, multi-line, quotes, markdown, extraction]
status: complete
last_updated: 2025-01-24
last_updated_by: Claude Code
type: feature-specification
test_file: test/code.test.ts
---

# Feature Specification: Code Extraction and Parsing

## Overview

This feature specification defines the JSONish parser's capabilities for handling code blocks, multi-line strings, and various quoting mechanisms. The parser must intelligently extract and parse JSON structures containing code snippets, programming language constructs, and complex string patterns commonly found in development workflows and AI-generated content.

## Feature Categories

### 1. Quote Handling Systems

#### 1.1 Multiple Quote Type Support
**Capability**: Parse JSON with code strings using different quote mechanisms
- **Backticks**: Handle JavaScript template literal syntax with backtick delimiters
- **Single Quotes**: Process single-quoted strings with proper escaping
- **Double Quotes**: Standard JSON double quotes with escape sequence support
- **Triple Quotes**: Python-style triple quote multiline strings (""")

**Example**:
```typescript
// Input: { "code": `print("Hello, world!")` }
// Output: { code: 'print("Hello, world!")' }
```

#### 1.2 Unescaped Quote Handling
**Capability**: Intelligently handle unescaped quotes within different quote contexts
- **Double quotes in double quotes**: Parse `"print("hello")"` correctly
- **Single quotes in single quotes**: Handle `'print('hello')'` patterns
- **Backticks in backticks**: Process nested template literals
- **Mixed quote scenarios**: Preserve original quote types in output

### 2. Multi-line String Processing

#### 2.1 Unescaped Newline Support
**Capability**: Handle literal newlines within quoted strings across all quote types
- **Preservation**: Convert literal newlines to proper `\n` escape sequences
- **Cross-quote consistency**: Same behavior for double quotes, single quotes, backticks, and triple quotes
- **Content integrity**: Maintain exact line structure and spacing

**Example**:
```typescript
// Input with literal newline:
// { "code": "print("Hello
// Goodbye")" }
// Output: { code: 'print("Hello\nGoodbye")' }
```

#### 2.2 Triple Quote Dedentation
**Capability**: Smart indentation handling for triple-quoted code blocks
- **Automatic dedentation**: Remove common leading whitespace from multiline code
- **Indentation preservation**: Maintain relative indentation within code blocks
- **Edge case handling**: Handle mixed spaces/tabs and varying indentation levels

**Example**:
```typescript
// Input with indented triple quotes:
// { "code": """
//     def main():
//       print("Hello!")
// """ }
// Output: { code: 'def main():\n  print("Hello!")' }
```

### 3. Code Block Extraction

#### 3.1 Markdown Code Fence Support
**Capability**: Extract code from markdown-style fenced code blocks
- **Triple backtick parsing**: Handle ```language and ``` delimiters
- **Language information**: Parse and optionally discard language specifiers
- **Nested structure**: Handle code blocks within JSON structures
- **Content preservation**: Maintain exact code formatting and structure

**Example**:
```typescript
// Input: { "code": ```python\ndef hello():\n    print("Hello!")\n``` }
// Output: { code: 'def hello():\n    print("Hello!")' }
```

#### 3.2 Mixed Content Extraction
**Capability**: Extract JSON structures from text containing code blocks
- **Text context parsing**: Find JSON within natural language descriptions
- **Multiple extraction**: Handle multiple code blocks and JSON structures
- **Format preservation**: Maintain code formatting while extracting JSON

### 4. Programming Language Patterns

#### 4.1 Language-Specific Constructs
**Capability**: Handle code patterns from various programming languages
- **JavaScript/TypeScript**: Template literals, arrow functions, async/await patterns
- **Python**: Class definitions, function decorators, multi-line strings
- **JSON structures**: Nested objects and arrays within code strings
- **Complex syntax**: Handle language-specific quoting and escaping rules

#### 4.2 Large Code Block Handling
**Capability**: Process substantial code snippets efficiently
- **Performance**: Handle large TypeScript/JavaScript files as code strings
- **Memory efficiency**: Process multi-hundred line code blocks
- **Structure preservation**: Maintain exact formatting, comments, and whitespace
- **Import/export handling**: Preserve module syntax and dependencies

**Example**:
```typescript
// Large code block with imports, async functions, error handling
// Must preserve exact structure including comments and formatting
```

### 5. Special Character and Edge Case Handling

#### 5.1 Special Character Support
**Capability**: Handle special characters and symbols in code strings
- **Unicode support**: Process international characters and emojis
- **Symbol handling**: Preserve special programming symbols ($@#%^&*())
- **Escape sequences**: Properly handle \n, \t, and other escape codes
- **Character encoding**: Maintain proper character encoding throughout parsing

#### 5.2 Edge Case Scenarios
**Capability**: Robust handling of edge cases and malformed input
- **Empty code**: Handle empty strings and whitespace-only content
- **Unquoted content**: Parse code values without surrounding quotes
- **Mixed terminators**: Handle JSON with complex closing bracket patterns
- **Nested quotes**: Process deeply nested quote structures

### 6. Error Recovery and Validation

#### 6.1 Malformed Code Block Recovery
**Capability**: Attempt to fix common code block parsing errors
- **Missing delimiters**: Add missing quote marks or backticks
- **Unbalanced quotes**: Balance mismatched quote characters
- **Incomplete blocks**: Handle truncated code blocks gracefully
- **Format detection**: Automatically detect intended quote type

#### 6.2 Content Validation
**Capability**: Validate code content integrity during parsing
- **Syntax preservation**: Ensure code syntax remains valid after parsing
- **Character integrity**: Prevent corruption of special characters
- **Structure validation**: Verify JSON structure remains intact
- **Error reporting**: Provide clear error messages for parsing failures

## Technical Implementation Requirements

### Parser Architecture
- **Multi-strategy parsing**: Support multiple quote types and formats simultaneously
- **State machine approach**: Track quote context and nesting levels
- **Incremental processing**: Handle streaming and partial code blocks
- **Context awareness**: Understand when content should be treated as code vs. text

### Integration Points
- **Schema awareness**: Respect Zod schema expectations for code fields
- **Type coercion**: Convert between different string representations appropriately  
- **Deserializer integration**: Proper integration with type coercion system
- **Error propagation**: Consistent error handling across all code parsing scenarios

### Performance Considerations
- **Large content handling**: Efficiently process substantial code blocks
- **Memory management**: Avoid excessive memory usage with large strings
- **Parsing speed**: Maintain reasonable performance for code-heavy JSON
- **Caching strategy**: Consider caching for repeated parsing operations

## Test Coverage Requirements

The implementation must pass all tests in `/Users/kyle/Documents/Projects/jsonish/test/code.test.ts`:

### Test Categories (139 total tests)
1. **Quote Handling** (5 tests): Basic quote type support
2. **Triple Quotes Special Cases** (2 tests): Dedentation and edge cases  
3. **Unescaped Newlines** (4 tests): Literal newline handling across quote types
4. **Unescaped Quotes** (6 tests): Quote-in-quote scenarios and known issues
5. **Multiline Code** (3 tests): Complex multiline structures and embedded quotes
6. **Complex Code Blocks** (3 tests): Language-specific patterns and JSON code
7. **Edge Cases** (5 tests): Empty content, whitespace, special characters, unicode
8. **Large Code Blocks** (1 test): Performance with substantial code content
9. **Triple Backticks** (9 tests): Markdown code fence extraction and processing

### Critical Test Scenarios
- **Mixed quote preservation**: Ensure output maintains appropriate quote types
- **Newline normalization**: Convert literal newlines to escape sequences consistently
- **Dedentation logic**: Smart indentation removal for triple-quoted blocks
- **Large content performance**: Handle 50+ line code blocks efficiently
- **Unicode and special characters**: Preserve international text and symbols
- **Error recovery**: Graceful handling of malformed code block syntax

## Success Criteria

### Functional Completeness
- ✅ All 139 tests in `test/code.test.ts` pass
- ✅ Support for all documented quote types and formats
- ✅ Proper handling of edge cases and malformed input
- ✅ Consistent behavior across different programming language patterns

### Performance Standards
- ✅ Large code blocks (1000+ characters) parse efficiently
- ✅ Memory usage remains reasonable for substantial content
- ✅ No performance degradation compared to basic string parsing

### Integration Quality
- ✅ Seamless integration with existing JSONish parser architecture
- ✅ Proper schema awareness and type coercion
- ✅ Consistent error handling and reporting
- ✅ Maintains backward compatibility with existing features

This specification ensures the JSONish parser can handle the complex code extraction and parsing requirements commonly encountered in modern development workflows, AI-generated content, and mixed-format data sources.