// Mirrors Rust jsonish/src/deserializer/coercer/ir_ref/coerce_alias.rs

import { z } from 'zod'
import type { Value } from '../../../jsonish/value'
import { ParsingContext, ParsingError, TypeCoercer } from '../index'
import type { BamlValueWithFlags } from '../../types'

/**
 * Coerce to alias (recursive type alias)
 * In TypeScript with Zod, this is handled differently than in Rust
 * Zod handles recursive types through z.lazy()
 */
export function coerceAlias(
  ctx: ParsingContext,
  target: z.ZodBranded<any, any>,
  value: Value | undefined,
  coercer: TypeCoercer
): BamlValueWithFlags | ParsingError {
  // For branded types (aliases), coerce the underlying type
  // This is a simplified version since we don't have the full IR system
  
  // Check for circular references
  if (value) {
    const aliasName = (target._def as any).description || 'RecursiveAlias'
    const classValuePair = `${aliasName}:${JSON.stringify(value)}`
    
    try {
      const nestedCtx = ctx.visitClassValuePair(classValuePair, value)
      return coercer.coerce(nestedCtx, target.unwrap(), value)
    } catch (e) {
      if (e instanceof Error && e.message.includes('Circular reference')) {
        return ctx.errorCircularReference(aliasName, value)
      }
      throw e
    }
  }
  
  return coercer.coerce(ctx, target.unwrap(), value)
}