// Mirrors Rust jsonish/src/deserializer/coercer/array_helper.rs

import { z } from 'zod'
import type { Value } from '../../jsonish/value'
import { ParsingContext, ParsingError } from './index'
import type { BamlValueWithFlags } from '../types'
import { getConditions } from '../types'
import { DeserializerConditions, Flag } from '../deserialize_flags'

// Coerce an array to a singular value by attempting to coerce the first element
export function coerceArrayToSingular(
  ctx: ParsingContext,
  target: z.ZodSchema,
  array: Value[],
  coercer: (value: Value | undefined) => BamlValueWithFlags | ParsingError
): BamlValueWithFlags | ParsingError {
  if (array.length === 0) {
    return ctx.errorUnexpectedNull(target)
  }
  
  if (array.length === 1) {
    const result = coercer(array[0])
    if (!(result instanceof ParsingError)) {
      // Add SingleToArray flag
      getConditions(result).addFlag(Flag.SingleToArray, undefined)
    }
    return result
  }
  
  // For multiple elements, try to coerce the first one
  // In Rust this uses FirstOfMultiple, but that's not in our Flag enum
  // So we'll just use the first element without a special flag
  return coercer(array[0])
}