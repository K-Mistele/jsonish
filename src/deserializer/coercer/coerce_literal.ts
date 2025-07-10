// Mirrors Rust jsonish/src/deserializer/coercer/coerce_literal.rs

import { z } from 'zod'
import type { Value } from '../../jsonish/value'
import { CompletionState } from '../../jsonish/value'
import { ParsingContext, ParsingError } from './index'
import { createString, createInt, createFloat, createBool, createNull, type BamlValueWithFlags, getConditions } from '../types'
import { DeserializerConditions, Flag } from '../deserialize_flags'
import { matchString } from './match_string'

// Coerce to literal value
export function coerceLiteral(
  ctx: ParsingContext,
  target: z.ZodLiteral<any>,
  value: Value | undefined
): BamlValueWithFlags | ParsingError {
  const literalValue = target.value
  
  if (!value) {
    if (literalValue === null) {
      return createNull(target)
    }
    return ctx.errorUnexpectedNull(target)
  }

  // Handle null literal
  if (literalValue === null) {
    if (value.type === 'null') {
      return createNull(target)
    } else {
      const flags = new DeserializerConditions()
      flags.addFlag(Flag.DefaultButHadValue, { value })
      return createNull(target, flags)
    }
  }

  // Handle string literal
  if (typeof literalValue === 'string') {
    if (value.type === 'string') {
      if (value.value === literalValue) {
        const result = createString(literalValue, target)
        if (value.completionState === CompletionState.Incomplete) {
          getConditions(result).addFlag(Flag.Incomplete, undefined)
        }
        return result
      }
      
      // Try fuzzy matching
      const matchResult = matchString(literalValue, value.value)
      if (matchResult) {
        const flags = new DeserializerConditions()
        flags.addFlag(Flag.SubstringMatch, { matched: value.value })
        const result = createString(literalValue, target, flags)
        if (value.completionState === CompletionState.Incomplete) {
          getConditions(result).addFlag(Flag.Incomplete, undefined)
        }
        return result
      }
    }
    
    // Try converting other types to string
    const flags = new DeserializerConditions()
    flags.addFlag(Flag.JsonToString, { value })
    return createString(literalValue, target, flags)
  }

  // Handle number literal
  if (typeof literalValue === 'number') {
    if (value.type === 'number' && value.value === literalValue) {
      const result = Number.isInteger(literalValue) 
        ? createInt(literalValue, target)
        : createFloat(literalValue, target)
      if (value.completionState === CompletionState.Incomplete) {
        getConditions(result).addFlag(Flag.Incomplete, undefined)
      }
      return result
    }
    
    // Try parsing string as number
    if (value.type === 'string') {
      const parsed = parseFloat(value.value)
      if (!isNaN(parsed) && parsed === literalValue) {
        const flags = new DeserializerConditions()
        flags.addFlag(Flag.StringToFloat, { original: value.value })
        return Number.isInteger(literalValue)
          ? createInt(literalValue, target, flags)
          : createFloat(literalValue, target, flags)
      }
    }
  }

  // Handle boolean literal
  if (typeof literalValue === 'boolean') {
    if (value.type === 'boolean' && value.value === literalValue) {
      return createBool(literalValue, target)
    }
    
    // Try parsing string as boolean
    if (value.type === 'string') {
      const lower = value.value.toLowerCase()
      if ((literalValue === true && lower === 'true') || 
          (literalValue === false && lower === 'false')) {
        const flags = new DeserializerConditions()
        flags.addFlag(Flag.StringToBool, { original: value.value })
        return createBool(literalValue, target, flags)
      }
    }
  }

  return ctx.errorUnexpectedType(target, value)
}