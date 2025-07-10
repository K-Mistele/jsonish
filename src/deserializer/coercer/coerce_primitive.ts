// Mirrors Rust jsonish/src/deserializer/coercer/coerce_primitive.rs

import { z } from 'zod'
import type { Value } from '../../jsonish/value'
import { CompletionState } from '../../jsonish/value'
import { ParsingContext, ParsingError } from './index'
import { createString, createInt, createFloat, createBool, createNull, type BamlValueWithFlags, getConditions } from '../types'
import { DeserializerConditions, Flag } from '../deserialize_flags'
import { coerceArrayToSingular } from './array_helper'

// Coerce to string
export function coerceString(
  ctx: ParsingContext,
  target: z.ZodString,
  value: Value | undefined
): BamlValueWithFlags | ParsingError {
  if (!value) {
    return ctx.errorUnexpectedNull(target)
  }

  switch (value.type) {
    case 'string': {
      const result = createString(value.value, target)
      if (value.completionState === CompletionState.Incomplete) {
        getConditions(result).addFlag(Flag.Incomplete, undefined)
      }
      return result
    }
    case 'null':
      return ctx.errorUnexpectedNull(target)
    default: {
      const flags = new DeserializerConditions()
      flags.addFlag(Flag.JsonToString, { value })
      return createString(value.toString(), target, flags)
    }
  }
}

// Coerce to integer
export function coerceInt(
  ctx: ParsingContext,
  target: z.ZodNumber,
  value: Value | undefined
): BamlValueWithFlags | ParsingError {
  if (!value) {
    return ctx.errorUnexpectedNull(target)
  }

  let result: BamlValueWithFlags | ParsingError

  switch (value.type) {
    case 'number': {
      const n = value.value
      if (Number.isInteger(n)) {
        result = createInt(n, target)
      } else {
        const flags = new DeserializerConditions()
        flags.addFlag(Flag.FloatToInt, { original: n })
        result = createInt(Math.round(n), target, flags)
      }
      break
    }
    case 'string': {
      const s = value.value.trim().replace(/,$/g, '')
      
      // First try comma-separated number parsing (to handle cases like "12,111")
      const commaSeparated = floatFromCommaSeparated(s)
      if (commaSeparated !== null) {
        const flags = new DeserializerConditions()
        if (!Number.isInteger(commaSeparated)) {
          flags.addFlag(Flag.FloatToInt, { original: commaSeparated })
        }
        result = createInt(Math.round(commaSeparated), target, flags)
      } else {
        // Try fraction parsing
        const fraction = floatFromMaybeFraction(s)
        if (fraction !== null) {
          const flags = new DeserializerConditions()
          flags.addFlag(Flag.FloatToInt, { original: fraction })
          result = createInt(Math.round(fraction), target, flags)
        } else {
          // Try standard integer parsing
          const parsedInt = parseInt(s, 10)
          if (!isNaN(parsedInt) && parsedInt.toString() === s) {
            result = createInt(parsedInt, target)
          } else {
            // Try parsing as float and round
            const parsedFloat = parseFloat(s)
            if (!isNaN(parsedFloat) && parsedFloat.toString() === s) {
              const flags = new DeserializerConditions()
              flags.addFlag(Flag.FloatToInt, { original: parsedFloat })
              result = createInt(Math.round(parsedFloat), target, flags)
            } else {
              result = ctx.errorUnexpectedType(target, value)
            }
          }
        }
      }
      break
    }
    case 'array':
      result = coerceArrayToSingular(ctx, target, value.value, (v) => coerceInt(ctx, target, v))
      break
    default:
      result = ctx.errorUnexpectedType(target, value)
  }

  // Add incomplete flag if needed
  if (!(result instanceof ParsingError) && value.completionState === CompletionState.Incomplete) {
    getConditions(result).addFlag(Flag.Incomplete, undefined)
  }

  return result
}

// Coerce to float
export function coerceFloat(
  ctx: ParsingContext,
  target: z.ZodNumber,
  value: Value | undefined
): BamlValueWithFlags | ParsingError {
  if (!value) {
    return ctx.errorUnexpectedNull(target)
  }

  let result: BamlValueWithFlags | ParsingError

  switch (value.type) {
    case 'number':
      result = createFloat(value.value, target)
      break
    case 'string': {
      const s = value.value.trim().replace(/,$/g, '')
      
      // First try comma-separated number parsing (to handle cases like "12,111")
      const commaSeparated = floatFromCommaSeparated(s)
      if (commaSeparated !== null) {
        const flags = new DeserializerConditions()
        if (s !== commaSeparated.toString()) {
          flags.addFlag(Flag.StringToFloat, { original: s })
        }
        result = createFloat(commaSeparated, target, flags)
      } else {
        // Try fraction parsing
        const fraction = floatFromMaybeFraction(s)
        if (fraction !== null) {
          result = createFloat(fraction, target)
        } else {
          // Try standard parsing as last resort
          const parsedFloat = parseFloat(s)
          if (!isNaN(parsedFloat) && parsedFloat.toString() === s) {
            result = createFloat(parsedFloat, target)
          } else {
            result = ctx.errorUnexpectedType(target, value)
          }
        }
      }
      break
    }
    case 'array':
      result = coerceArrayToSingular(ctx, target, value.value, (v) => coerceFloat(ctx, target, v))
      break
    default:
      result = ctx.errorUnexpectedType(target, value)
  }

  // Add incomplete flag if needed
  if (!(result instanceof ParsingError) && value.completionState === CompletionState.Incomplete) {
    getConditions(result).addFlag(Flag.Incomplete, undefined)
  }

  return result
}

// Coerce to boolean
export function coerceBool(
  ctx: ParsingContext,
  target: z.ZodBoolean,
  value: Value | undefined
): BamlValueWithFlags | ParsingError {
  if (!value) {
    return ctx.errorUnexpectedNull(target)
  }

  let result: BamlValueWithFlags | ParsingError

  switch (value.type) {
    case 'boolean':
      result = createBool(value.value, target)
      break
    case 'string': {
      const s = value.value.toLowerCase()
      if (s === 'true') {
        const flags = new DeserializerConditions()
        flags.addFlag(Flag.StringToBool, { original: value.value })
        result = createBool(true, target, flags)
      } else if (s === 'false') {
        const flags = new DeserializerConditions()
        flags.addFlag(Flag.StringToBool, { original: value.value })
        result = createBool(false, target, flags)
      } else {
        // Try fuzzy matching
        const candidates: Array<[string, string[]]> = [
          ['true', ['true', 'True', 'TRUE']],
          ['false', ['false', 'False', 'FALSE']]
        ]
        
        // This would use match_string module, but for now let's do simple matching
        const matchResult = candidates.find(([_, variations]) => 
          variations.includes(value.value)
        )
        
        if (matchResult) {
          const flags = new DeserializerConditions()
          flags.addFlag(Flag.StringToBool, { original: value.value })
          result = createBool(matchResult[0] === 'true', target, flags)
        } else {
          result = ctx.errorUnexpectedType(target, value)
        }
      }
      break
    }
    case 'array':
      result = coerceArrayToSingular(ctx, target, value.value, (v) => coerceBool(ctx, target, v))
      break
    default:
      result = ctx.errorUnexpectedType(target, value)
  }

  // Add incomplete flag if needed
  if (!(result instanceof ParsingError) && value.completionState === CompletionState.Incomplete) {
    getConditions(result).addFlag(Flag.Incomplete, undefined)
  }

  return result
}

// Coerce to null
export function coerceNull(
  ctx: ParsingContext,
  target: z.ZodNull,
  value: Value | undefined
): BamlValueWithFlags | ParsingError {
  if (!value || value.type === 'null') {
    return createNull(target)
  }

  const flags = new DeserializerConditions()
  flags.addFlag(Flag.DefaultButHadValue, { value })
  return createNull(target, flags)
}

// Helper function to parse fractions
function floatFromMaybeFraction(value: string): number | null {
  const parts = value.split('/')
  if (parts.length !== 2) return null
  
  const numerator = parseFloat(parts[0].trim())
  const denominator = parseFloat(parts[1].trim())
  
  if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
    return null
  }
  
  return numerator / denominator
}

// Helper function to parse comma-separated numbers
function floatFromCommaSeparated(value: string): number | null {
  // Remove trailing dots and commas
  let cleaned = value.trim().replace(/[,.]$/g, '')
  
  // Remove commas and currency symbols
  cleaned = cleaned.replace(/[$,]/g, '')
  
  // Check if the cleaned value is a valid number representation
  // This regex matches valid number formats (including decimals and scientific notation)
  const validNumberRegex = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/
  
  if (validNumberRegex.test(cleaned)) {
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed)) {
      return parsed
    }
  }
  
  // Try to extract number from text using regex
  const regex = /[-+]?\$?(?:\d+(?:,\d+)*(?:\.\d+)?|\d+\.\d+|\d+|\.\d+)(?:e[-+]?\d+)?/
  const match = value.match(regex)
  
  if (match && match[0] === value.trim()) {  // Only accept if the match is the entire string
    const numberStr = match[0]
    const withoutCurrency = numberStr.replace(/^\$/, '')
    const withoutCommas = withoutCurrency.replace(/,/g, '')
    const extracted = parseFloat(withoutCommas)
    
    if (!isNaN(extracted)) {
      return extracted
    }
  }
  
  return null
}