// Mirrors Rust jsonish/src/deserializer/mod.rs

// Export all submodules
export * from './types'
export * from './deserialize_flags'
export * from './score'
export * from './coercer'

// Main deserialize function
import { z } from 'zod'
import type { Value } from '../jsonish/value'
import { FieldTypeCoercer } from './coercer/field_type'
import { ParsingContext, ParsingError } from './coercer'
import type { BamlValueWithFlags } from './types'

/**
 * Deserialize a parsed JSON value against a Zod schema
 * 
 * @param value - The parsed JSON value
 * @param schema - The Zod schema to validate against
 * @returns Either a BamlValueWithFlags on success or ParsingError on failure
 */
export function deserialize(
  value: Value | undefined,
  schema: z.ZodSchema
): BamlValueWithFlags | ParsingError {
  const coercer = new FieldTypeCoercer()
  const ctx = new ParsingContext()
  
  return coercer.coerce(ctx, schema, value)
}

// Re-export commonly used types for convenience
export type { ParsingContext, ParsingError, TypeCoercer } from './coercer'
export type { BamlValueWithFlags } from './types'
export { Flag, DeserializerConditions } from './deserialize_flags'