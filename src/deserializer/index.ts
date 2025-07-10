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
import { toPlainValue } from './types'

/**
 * Deserialize a parsed JSON value against a Zod schema
 * 
 * @param value - The parsed JSON value
 * @param schema - The Zod schema to validate against
 * @returns Either the typed value matching the schema or ParsingError on failure
 */
export function deserialize<T>(
  value: Value | undefined,
  schema: z.ZodSchema<T>
): T | ParsingError {
  const coercer = new FieldTypeCoercer()
  const ctx = new ParsingContext()
  
  const result = coercer.coerce(ctx, schema, value)
  
  if (result instanceof ParsingError) {
    return result
  }
  
  // Convert BamlValueWithFlags to plain JavaScript value
  const plainValue = toPlainValue(result)
  
  // The coercer should have already ensured the value matches the schema,
  // but we can validate again to be safe
  try {
    return schema.parse(plainValue) as T
  } catch (e) {
    return ctx.errorInternal(`Schema validation failed after coercion: ${e}`)
  }
}

// Re-export commonly used types for convenience
export type { ParsingContext, ParsingError, TypeCoercer } from './coercer'
export { Flag, DeserializerConditions } from './deserialize_flags'