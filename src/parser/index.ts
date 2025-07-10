// Main parsing entry point - mirrors the exports from Rust parser/mod.rs
export { nextFromMode, parse, ParsingMode, type ParseOptions } from './entry'

// Additional parsing utilities for backward compatibility
export { defaultParseOptions, parseFunc, parseJsonish, parsePartial } from './entry'

// Markdown parser utilities for advanced usage
export { createCodeBlock, createString, isCodeBlock, isString } from './markdown-parser'
export type { MarkdownResult } from './markdown-parser'

// Value utilities - re-exported for convenience
export { CompletionState, Fixes, ValueUtils } from '../value'
export type { Value } from '../value'
