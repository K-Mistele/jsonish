// Mirrors Rust jsonish/src/deserializer/coercer/field_type.rs

import { z } from 'zod'
import type { Value } from '../../jsonish/value'
import { CompletionState } from '../../jsonish/value'
import { ParsingContext, ParsingError, TypeCoercer, DefaultValue } from './index'
import type { BamlValueWithFlags } from '../types'
import { 
  createNull, 
  getConditions,
  createString,
  createInt,
  createFloat,
  createBool,
  createList,
  createMap
} from '../types'
import { DeserializerConditions, Flag } from '../deserialize_flags'
import { 
  coerceString, 
  coerceInt, 
  coerceFloat, 
  coerceBool, 
  coerceNull 
} from './coerce_primitive'
import { coerceArray } from './coerce_array'
import { coerceLiteral } from './coerce_literal'
import { coerceMap } from './coerce_map'
import { coerceUnion } from './coerce_union'
import { coerceAlias } from './ir_ref/coerce_alias'
import { coerceClass } from './ir_ref/coerce_class'
import { coerceEnum } from './ir_ref/coerce_enum'

// Main field type coercer
export class FieldTypeCoercer implements TypeCoercer, DefaultValue {
  constructor() {}

  coerce(
    ctx: ParsingContext,
    target: z.ZodSchema,
    value: Value | undefined
  ): BamlValueWithFlags | ParsingError {
    // Handle special wrapper types from the parser
    if (value) {
      // Handle any_of values - try each choice until one works
      if (value.type === 'any_of') {
        const { choices, originalString } = value
        
        // If target expects a string, prefer the original string
        if (target instanceof z.ZodString || target instanceof z.ZodEnum || target instanceof z.ZodLiteral) {
          // Create a string value from originalString
          const stringValue: Value = { 
            type: 'string', 
            value: originalString, 
            completionState: CompletionState.Complete 
          }
          return this.coerce(ctx, target, stringValue)
        }
        
        // Try each choice
        for (const choice of choices) {
          const result = this.coerce(ctx, target, choice)
          if (!(result instanceof ParsingError)) {
            return result
          }
        }
        
        // Fallback to original string
        const stringValue: Value = { 
          type: 'string', 
          value: originalString, 
          completionState: CompletionState.Complete 
        }
        return this.coerce(ctx, target, stringValue)
      }
      
      // Handle markdown wrapper - unwrap and process the inner value
      if (value.type === 'markdown') {
        return this.coerce(ctx, target, value.value)
      }
      
      // Handle fixed_json wrapper - unwrap and process the inner value
      if (value.type === 'fixed_json') {
        return this.coerce(ctx, target, value.value)
      }
    }

    // Handle optional types
    if (target instanceof z.ZodOptional) {
      if (!value || value.type === 'null') {
        return this.defaultValue()
      }
      return this.coerce(ctx, target.unwrap(), value)
    }

    // Handle nullable types
    if (target instanceof z.ZodNullable) {
      if (!value || value.type === 'null') {
        return createNull(target)
      }
      return this.coerce(ctx, target.unwrap(), value)
    }

    // Handle default types
    if (target instanceof z.ZodDefault) {
      if (!value || value.type === 'null') {
        const defaultVal = target._def.defaultValue()
        // Convert default value to Value type and coerce
        const valueFromDefault = this.jsToValue(defaultVal)
        const result = this.coerce(ctx, target._def.innerType, valueFromDefault)
        if (!(result instanceof ParsingError)) {
          getConditions(result).addFlag(Flag.DefaultFromNoValue, undefined)
        }
        return result
      }
      return this.coerce(ctx, target._def.innerType, value)
    }

    // Primitive types
    if (target instanceof z.ZodString) {
      return coerceString(ctx, target, value)
    }
    
    if (target instanceof z.ZodNumber) {
      // Check if it's an integer constraint
      const checks = (target._def as any).checks || []
      const isInt = checks.some((check: any) => check.kind === 'int')
      return isInt ? coerceInt(ctx, target, value) : coerceFloat(ctx, target, value)
    }
    
    if (target instanceof z.ZodBoolean) {
      return coerceBool(ctx, target, value)
    }
    
    if (target instanceof z.ZodNull) {
      return coerceNull(ctx, target, value)
    }

    // Complex types
    if (target instanceof z.ZodArray) {
      return coerceArray(ctx, target, value, this)
    }
    
    if (target instanceof z.ZodLiteral) {
      return coerceLiteral(ctx, target, value)
    }
    
    if (target instanceof z.ZodRecord) {
      return coerceMap(ctx, target, value, this, this)
    }
    
    if (target instanceof z.ZodUnion) {
      const coercers = target.options.map(() => this)
      return coerceUnion(ctx, target, value, coercers)
    }

    // Object types (classes)
    if (target instanceof z.ZodObject) {
      return coerceClass(ctx, target, value, this)
    }

    // Enum types
    if (target instanceof z.ZodEnum) {
      return coerceEnum(ctx, target, value)
    }

    // Branded types (aliases)
    if (target instanceof z.ZodBranded) {
      return coerceAlias(ctx, target, value, this)
    }

    // Any type
    if (target instanceof z.ZodAny) {
      if (!value) {
        return ctx.errorUnexpectedNull(target)
      }
      // Convert Value to BamlValueWithFlags based on its type
      return this.valueToBAMLValue(value, target)
    }

    return ctx.errorInternal(`Unsupported Zod type: ${target.constructor.name}`)
  }

  defaultValue(error?: ParsingError): BamlValueWithFlags {
    // For optional types, return null
    return createNull(z.null())
  }

  // Helper to convert JS value to Value type
  private jsToValue(val: any): Value | undefined {
    if (val === null || val === undefined) {
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
        value: val.map(v => this.jsToValue(v)!).filter(v => v !== undefined),
        completionState: CompletionState.Complete
      }
    }
    if (typeof val === 'object') {
      const entries: Array<[string, Value]> = []
      for (const [k, v] of Object.entries(val)) {
        const value = this.jsToValue(v)
        if (value) {
          entries.push([k, value])
        }
      }
      return {
        type: 'object',
        value: entries,
        completionState: CompletionState.Complete
      }
    }
    return undefined
  }

  // Helper to convert Value to BamlValueWithFlags
  private valueToBAMLValue(value: Value, target: z.ZodSchema): BamlValueWithFlags {
    switch (value.type) {
      case 'string':
        return createString(value.value, target)
      case 'number':
        return Number.isInteger(value.value)
          ? createInt(value.value, target)
          : createFloat(value.value, target)
      case 'boolean':
        return createBool(value.value, target)
      case 'null':
        return createNull(target)
      case 'array':
        // Recursively convert array items
        const items = value.value.map(v => this.valueToBAMLValue(v, z.any()))
        return createList(items, target)
      case 'object':
        // Convert to map
        const map = new Map<string, [DeserializerConditions, BamlValueWithFlags]>()
        for (const [k, v] of value.value) {
          map.set(k, [new DeserializerConditions(), this.valueToBAMLValue(v, z.any())])
        }
        return createMap(map, target)
      case 'any_of':
        // For any_of, try to convert the first choice or fallback to string
        if (value.choices.length > 0) {
          return this.valueToBAMLValue(value.choices[0], target)
        }
        return createString(value.originalString, target)
      case 'markdown':
        // For markdown, unwrap and convert the inner value
        return this.valueToBAMLValue(value.value, target)
      case 'fixed_json':
        // For fixed_json, unwrap and convert the inner value
        return this.valueToBAMLValue(value.value, target)
      default:
        // For other types, convert to string
        return createString(JSON.stringify(value), target)
    }
  }
}