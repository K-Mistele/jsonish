// Mirrors Rust jsonish/src/deserializer/coercer/coerce_union.rs

import { z } from 'zod'
import type { Value } from '../../jsonish/value'
import { ParsingContext, ParsingError, TypeCoercer } from './index'
import type { BamlValueWithFlags } from '../types'
import { DeserializerConditions, Flag } from '../deserialize_flags'
import { score } from '../types'

// Result type helper
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

// Coerce to union type
export function coerceUnion(
  ctx: ParsingContext,
  target: z.ZodUnion<any>,
  value: Value | undefined,
  coercers: TypeCoercer[]
): BamlValueWithFlags | ParsingError {
  if (!value) {
    // Try each option with null
    const results: Result<BamlValueWithFlags, ParsingError>[] = []
    
    for (let i = 0; i < target.options.length; i++) {
      const result = coercers[i].coerce(ctx, target.options[i], undefined)
      if (result instanceof ParsingError) {
        results.push({ ok: false, error: result })
      } else {
        results.push({ ok: true, value: result })
      }
    }
    
    return selectBestUnionMatch(ctx, results)
  }

  const results: Result<BamlValueWithFlags, ParsingError>[] = []
  
  // Try each union option
  for (let i = 0; i < target.options.length; i++) {
    const optionCtx = ctx.enterScope(`option[${i}]`)
    const result = coercers[i].coerce(optionCtx, target.options[i], value)
    
    if (result instanceof ParsingError) {
      results.push({ ok: false, error: result })
    } else {
      results.push({ ok: true, value: result })
    }
  }
  
  return selectBestUnionMatch(ctx, results)
}

// Select the best match from union results
function selectBestUnionMatch(
  ctx: ParsingContext,
  results: Result<BamlValueWithFlags, ParsingError>[]
): BamlValueWithFlags | ParsingError {
  const successes: Array<[number, BamlValueWithFlags]> = []
  const errors: ParsingError[] = []
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.ok) {
      successes.push([i, result.value])
    } else {
      errors.push(result.error)
    }
  }
  
  if (successes.length === 0) {
    // All failed
    return ctx.errorMergeMultiple('No union variant matched', errors)
  }
  
  if (successes.length === 1) {
    // Single match
    const [index, value] = successes[0]
    const flags = new DeserializerConditions()
    flags.addFlag(Flag.UnionMatch, { index, matches: results })
    
    // Add flag to the result
    const valueConditions = 'value' in value && value.value && 'flags' in value.value
      ? value.value.flags
      : 'flags' in value
      ? value.flags
      : null
      
    if (valueConditions) {
      valueConditions.addFlag(Flag.UnionMatch, { index, matches: results })
    }
    
    return value
  }
  
  // Multiple matches - pick the one with the lowest score
  const scored = successes.map(([index, value]) => ({
    index,
    value,
    score: score(value)
  }))
  
  scored.sort((a, b) => a.score - b.score)
  
  const best = scored[0]
  const flags = new DeserializerConditions()
  flags.addFlag(Flag.UnionMatch, { index: best.index, matches: results })
  
  // Add flag to the result
  const valueConditions = 'value' in best.value && best.value.value && 'flags' in best.value.value
    ? best.value.value.flags
    : 'flags' in best.value
    ? best.value.flags
    : null
    
  if (valueConditions) {
    valueConditions.addFlag(Flag.UnionMatch, { index: best.index, matches: results })
  }
  
  return best.value
}