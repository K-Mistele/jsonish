// Mirrors Rust jsonish/src/deserializer/coercer/coerce_array.rs

import { z } from 'zod'
import type { Value } from '../../jsonish/value'
import { CompletionState } from '../../jsonish/value'
import { ParsingContext, ParsingError, TypeCoercer } from './index'
import { createList, type BamlValueWithFlags, getConditions } from '../types'
import { DeserializerConditions, Flag } from '../deserialize_flags'

// Coerce to array
export function coerceArray(
  ctx: ParsingContext,
  target: z.ZodArray<any>,
  value: Value | undefined,
  itemCoercer: TypeCoercer
): BamlValueWithFlags | ParsingError {
  if (!value) {
    return ctx.errorUnexpectedNull(target)
  }

  let items: BamlValueWithFlags[] = []
  let flags = new DeserializerConditions()
  
  switch (value.type) {
    case 'array': {
      for (let i = 0; i < value.value.length; i++) {
        const itemCtx = ctx.enterScope(`[${i}]`)
        const itemResult = itemCoercer.coerce(itemCtx, target.element, value.value[i])
        
        if (itemResult instanceof ParsingError) {
          flags.addFlag(Flag.ArrayItemParseError, { index: i, error: itemResult })
        } else {
          items.push(itemResult)
        }
      }
      break
    }
    case 'null':
      return ctx.errorUnexpectedNull(target)
    default: {
      // Try to coerce single value to array
      const itemResult = itemCoercer.coerce(ctx, target.element, value)
      if (itemResult instanceof ParsingError) {
        return ctx.errorUnexpectedType(target, value)
      }
      items.push(itemResult)
      flags.addFlag(Flag.SingleToArray, undefined)
    }
  }

  const result = createList(items, target, flags)
  
  // Add incomplete flag if needed
  if ('completionState' in value && value.completionState === CompletionState.Incomplete) {
    getConditions(result).addFlag(Flag.Incomplete, undefined)
  }

  return result
}