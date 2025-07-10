// Mirrors Rust jsonish/src/deserializer/coercer/ir_ref/mod.rs

export * from './coerce_alias'
export * from './coerce_class'
export * from './coerce_enum'

import { z } from 'zod'
import type { Value } from '../../../jsonish/value'
import { ParsingContext, ParsingError, TypeCoercer } from '../index'
import type { BamlValueWithFlags } from '../../types'

// IrRef enum equivalent - using a discriminated union
export type IrRef = 
  | { type: 'enum'; name: string }
  | { type: 'class'; name: string; mode?: 'streaming' | 'non-streaming' }
  | { type: 'recursive-alias'; name: string }

// IrRef coercer implementation
export class IrRefCoercer implements TypeCoercer {
  constructor(private ref: IrRef) {}

  coerce(
    ctx: ParsingContext,
    target: z.ZodSchema,
    value: Value | undefined
  ): BamlValueWithFlags | ParsingError {
    switch (this.ref.type) {
      case 'enum':
        // In TypeScript, we handle this differently since we don't have the IR
        // We'll use the Zod enum directly
        return ctx.errorInternal(`Enum reference coercion not implemented: ${this.ref.name}`)
      
      case 'class':
        // Similarly for classes
        return ctx.errorInternal(`Class reference coercion not implemented: ${this.ref.name}`)
      
      case 'recursive-alias':
        // And for recursive aliases
        return ctx.errorInternal(`Recursive alias coercion not implemented: ${this.ref.name}`)
    }
  }
}