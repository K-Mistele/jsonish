// Main parsing API - mirrors the exports from Rust jsonish/mod.rs
export { parse, type ParseOptions } from './parser/entry'

// Core types - mirrors the exports from Rust value.rs
export { CompletionState, Fixes, type Value } from '../value'
