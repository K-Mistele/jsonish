// Mirrors Rust jsonish/src/deserializer/coercer/coerce_map.rs

import { z } from 'zod'
import type { Value } from '../../jsonish/value'
import { CompletionState } from '../../jsonish/value'
import { ParsingContext, ParsingError, TypeCoercer } from './index'
import { createMap, type BamlValueWithFlags, getConditions } from '../types'
import { DeserializerConditions, Flag } from '../deserialize_flags'

// Coerce to map/record
export function coerceMap(
  ctx: ParsingContext,
  target: z.ZodRecord<any>,
  value: Value | undefined,
  keyCoercer: TypeCoercer,
  valueCoercer: TypeCoercer
): BamlValueWithFlags | ParsingError {
  if (!value) {
    return ctx.errorUnexpectedNull(target)
  }

  const items = new Map<string, [DeserializerConditions, BamlValueWithFlags]>()
  let flags = new DeserializerConditions()

  switch (value.type) {
    case 'object': {
      for (const [key, val] of value.value) {
        const keyCtx = ctx.enterScope(key)
        
        // For maps, keys must be strings
        let keyFlags = new DeserializerConditions()
        let keyStr = key
        
        // Coerce the value - ZodRecord has element property for value type
        const valueResult = valueCoercer.coerce(keyCtx, target.element, val)
        if (valueResult instanceof ParsingError) {
          flags.addFlag(Flag.MapValueParseError, { key, error: valueResult })
        } else {
          items.set(keyStr, [keyFlags, valueResult])
        }
      }
      break
    }
    case 'array': {
      // Try to interpret array as key-value pairs
      for (let i = 0; i < value.value.length; i++) {
        const item = value.value[i]
        if (item.type === 'object') {
          const objFields = new Map(item.value)
          const keys = Array.from(objFields.keys())
          if (keys.length === 2 && keys.includes('key') && keys.includes('value')) {
            // Treat as key-value pair
            const keyVal = objFields.get('key')
            const valueVal = objFields.get('value')
            
            if (keyVal && keyVal.type === 'string') {
              const valueResult = valueCoercer.coerce(
                ctx.enterScope(`[${i}].value`),
                target.element,
                valueVal
              )
              if (!(valueResult instanceof ParsingError)) {
                items.set(keyVal.value, [new DeserializerConditions(), valueResult])
              }
            }
          }
        }
      }
      
      if (items.size === 0) {
        return ctx.errorUnexpectedType(target, value)
      }
      flags.addFlag(Flag.ObjectToMap, { value })
      break
    }
    case 'null':
      return ctx.errorUnexpectedNull(target)
    default:
      return ctx.errorUnexpectedType(target, value)
  }

  const result = createMap(items, target, flags)
  
  // Add incomplete flag if needed
  if ('completionState' in value && value.completionState === CompletionState.Incomplete) {
    getConditions(result).addFlag(Flag.Incomplete, undefined)
  }

  return result
}