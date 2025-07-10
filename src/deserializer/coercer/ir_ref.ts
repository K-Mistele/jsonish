// Mirrors Rust jsonish/src/deserializer/coercer/ir_ref.rs

import { z } from 'zod'
import type { Value } from '../../jsonish/value'
import { CompletionState } from '../../jsonish/value'
import { ParsingContext, ParsingError, TypeCoercer } from './index'
import { 
  createEnum, 
  createClass, 
  type BamlValueWithFlags,
  getConditions
} from '../types'
import { DeserializerConditions, Flag } from '../deserialize_flags'
import { matchOneFromMany } from './match_string'

// Coerce to alias (branded type)
export function coerceAlias(
  ctx: ParsingContext,
  target: z.ZodBranded<any, any>,
  value: Value | undefined,
  coercer: TypeCoercer
): BamlValueWithFlags | ParsingError {
  // For branded types, coerce the underlying type
  return coercer.coerce(ctx, target.unwrap(), value)
}

// Coerce to class (object)
export function coerceClass(
  ctx: ParsingContext,
  target: z.ZodObject<any>,
  value: Value | undefined,
  coercer: TypeCoercer
): BamlValueWithFlags | ParsingError {
  if (!value) {
    return ctx.errorUnexpectedNull(target)
  }

  const shape = target.shape
  const fields = new Map<string, BamlValueWithFlags>()
  const unparsed: Array<[string, ParsingError]> = []
  const missing: string[] = []
  let flags = new DeserializerConditions()

  switch (value.type) {
    case 'object': {
      const providedFields = new Map(value.value)
      
      // Process each field in the schema
      for (const [fieldName, fieldSchema] of Object.entries(shape)) {
        const fieldValue = providedFields.get(fieldName)
        const fieldCtx = ctx.enterScope(fieldName)
        
        if (!fieldValue) {
          // Check if field is optional
          if (fieldSchema instanceof z.ZodOptional || 
              fieldSchema instanceof z.ZodNullable ||
              fieldSchema instanceof z.ZodDefault) {
            const result = coercer.coerce(fieldCtx, fieldSchema as z.ZodSchema, undefined)
            if (!(result instanceof ParsingError)) {
              fields.set(fieldName, result)
            }
          } else {
            missing.push(fieldName)
          }
        } else {
          const result = coercer.coerce(fieldCtx, fieldSchema as z.ZodSchema, fieldValue)
          if (result instanceof ParsingError) {
            unparsed.push([fieldName, result])
          } else {
            fields.set(fieldName, result)
          }
        }
      }
      
      // Check for extra fields
      for (const [key, val] of value.value) {
        if (!shape.hasOwnProperty(key)) {
          flags.addFlag(Flag.ExtraKey, { key, value: val })
        }
      }
      
      break
    }
    case 'string': {
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(value.value)
        const objValue: Value = {
          type: 'object',
          value: Object.entries(parsed).map(([k, v]) => [k, jsonToValue(v)]),
          completionState: value.completionState
        }
        return coerceClass(ctx, target, objValue, coercer)
      } catch {
        // If not JSON, treat as single field
        flags.addFlag(Flag.ObjectToString, { value })
      }
      break
    }
    case 'null':
      return ctx.errorUnexpectedNull(target)
    default:
      return ctx.errorUnexpectedType(target, value)
  }

  if (missing.length > 0 || unparsed.length > 0) {
    return ctx.errorMissingRequiredField(unparsed, missing, value)
  }

  // Get class name from schema description or use generic "Object"
  const className = (target._def as any).description || 'Object'
  const result = createClass(className, fields, target, flags)
  
  // Add incomplete flag if needed
  if ('completionState' in value && value.completionState === CompletionState.Incomplete) {
    getConditions(result).addFlag(Flag.Incomplete, undefined)
  }

  return result
}

// Coerce to enum
export function coerceEnum(
  ctx: ParsingContext,
  target: z.ZodEnum<any>,
  value: Value | undefined
): BamlValueWithFlags | ParsingError {
  if (!value) {
    return ctx.errorUnexpectedNull(target)
  }

  const options = target.options as string[]
  
  switch (value.type) {
    case 'string': {
      const val = value.value
      
      // Exact match
      if (options.includes(val)) {
        const result = createEnum('Enum', val, target)
        if (value.completionState === CompletionState.Incomplete) {
          getConditions(result).addFlag(Flag.Incomplete, undefined)
        }
        return result
      }
      
      // Try fuzzy matching
      const matchResult = matchOneFromMany(val, options)
      if (matchResult) {
        const result = createEnum('Enum', matchResult.match, target, matchResult.flags)
        if (value.completionState === CompletionState.Incomplete) {
          getConditions(result).addFlag(Flag.Incomplete, undefined)
        }
        return result
      }
      
      return ctx.errorUnexpectedType(target, value)
    }
    case 'null':
      return ctx.errorUnexpectedNull(target)
    default:
      // Try to convert to string
      const stringValue = value.toString()
      if (options.includes(stringValue)) {
        const flags = new DeserializerConditions()
        flags.addFlag(Flag.JsonToString, { value })
        return createEnum('Enum', stringValue, target, flags)
      }
      return ctx.errorUnexpectedType(target, value)
  }
}

// Helper to convert JSON to Value
function jsonToValue(val: any): Value {
  if (val === null) {
    return { type: 'null' }
  }
  if (typeof val === 'string') {
    return { type: 'string', value: val, completionState: CompletionState.Complete }
  }
  if (typeof val === 'number') {
    return { type: 'number', value: val, completionState: CompletionState.Complete }
  }
  if (typeof val === 'boolean') {
    return { type: 'boolean', value: val }
  }
  if (Array.isArray(val)) {
    return {
      type: 'array',
      value: val.map(jsonToValue),
      completionState: CompletionState.Complete
    }
  }
  if (typeof val === 'object') {
    return {
      type: 'object',
      value: Object.entries(val).map(([k, v]) => [k, jsonToValue(v)]),
      completionState: CompletionState.Complete
    }
  }
  // Fallback to string
  return { type: 'string', value: String(val), completionState: CompletionState.Complete }
}