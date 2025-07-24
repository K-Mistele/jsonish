// Main JSONish library exports

// Parser API
export { createParser, type JsonishParser } from './jsonish/parser'
export { parse, parseJsonish, parsePartial, type ParseOptions, defaultParseOptions, ParsingMode } from './jsonish/parser'

// Value types
export { Fixes, CompletionState, ValueUtils, type Value } from './jsonish/value'

// Deserializer API  
export { deserialize, type ParsingContext, type ParsingError, type TypeCoercer } from './deserializer'
export { Flag, DeserializerConditions } from './deserializer'