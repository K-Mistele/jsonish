// Mirrors Rust jsonish/src/deserializer/coercer/ir_ref/coerce_enum.rs

import { z } from 'zod'
import type { Value } from '../../../jsonish/value'
import { CompletionState } from '../../../jsonish/value'
import { ParsingContext, ParsingError } from '../index'
import { createEnum, type BamlValueWithFlags, getConditions } from '../../types'
import { DeserializerConditions, Flag } from '../../deserialize_flags'
import { matchString, matchOneFromMany } from '../match_string'

// Helper to get enum match candidates
function enumMatchCandidates(enumName: string, options: string[]): Array<[string, string[]]> {
  // In the Rust version, this uses the Enum type with descriptions
  // Here we'll use a simpler approach with just the enum values
  return options.map(option => [
    option,
    [option] // Just the option itself as a candidate
  ])
}

/**
 * Coerce to enum
 */
export function coerceEnum(
  ctx: ParsingContext,
  target: z.ZodEnum<any>,
  value: Value | undefined
): BamlValueWithFlags | ParsingError {
  if (!value) {
    return ctx.errorUnexpectedNull(target)
  }

  const options = target.options as string[]
  const enumName = (target._def as any).description || 'Enum'
  
  switch (value.type) {
    case 'string': {
      const val = value.value
      
      // Exact match
      if (options.includes(val)) {
        const result = createEnum(enumName, val, target)
        if (value.completionState === CompletionState.Incomplete) {
          getConditions(result).addFlag(Flag.Incomplete, undefined)
        }
        return result
      }
      
      // Try fuzzy matching with all options
      const candidates = enumMatchCandidates(enumName, options)
      const matchResult = matchOneFromMany(val, options)
      
      if (matchResult) {
        const result = createEnum(enumName, matchResult.match, target, matchResult.flags)
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
        return createEnum(enumName, stringValue, target, flags)
      }
      return ctx.errorUnexpectedType(target, value)
  }
}