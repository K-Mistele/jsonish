// Mirrors Rust jsonish/src/helpers/mod.rs

import { z } from 'zod'
import { parse } from '../jsonish'
import type { Value } from '../jsonish/value'
import { FieldTypeCoercer } from '../deserializer/coercer/field_type'
import { ParsingContext } from '../deserializer/coercer'
import type { BamlValueWithFlags } from '../deserializer/types'
import { toPlainValue } from '../deserializer/types'

// Export common test schemas and utilities
export * from './common'

/**
 * Helper function to deserialize a value against a schema
 * This is useful for testing
 */
export function deserializeValue(
  value: Value | undefined,
  schema: z.ZodSchema
): { success: boolean; value?: any; error?: string } {
  const coercer = new FieldTypeCoercer()
  const ctx = new ParsingContext()
  
  const result = coercer.coerce(ctx, schema, value)
  
  if (result instanceof Error) {
    return { success: false, error: result.toString() }
  }
  
  return { 
    success: true, 
    value: toPlainValue(result as BamlValueWithFlags) 
  }
}

/**
 * Helper to parse and deserialize JSON string
 */
export function parseAndDeserialize(
  jsonString: string,
  schema: z.ZodSchema
): { success: boolean; value?: any; error?: string } {
  try {
    const parsed = parse(jsonString)
    return deserializeValue(parsed, schema)
  } catch (e) {
    return { 
      success: false, 
      error: e instanceof Error ? e.message : String(e) 
    }
  }
}

/**
 * Create a test schema for a simple class
 */
export function createTestClassSchema(
  name: string,
  fields: Record<string, z.ZodSchema>
): z.ZodObject<any> {
  return z.object(fields).describe(name)
}

/**
 * Create a test enum schema
 */
export function createTestEnumSchema(
  name: string,
  values: string[]
): z.ZodEnum<[string, ...string[]]> {
  return z.enum(values as [string, ...string[]]).describe(name)
}