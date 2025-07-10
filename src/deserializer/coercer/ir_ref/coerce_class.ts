// Mirrors Rust jsonish/src/deserializer/coercer/ir_ref/coerce_class.rs

import { z } from 'zod'
import type { Value } from '../../../jsonish/value'
import { CompletionState } from '../../../jsonish/value'
import { ParsingContext, ParsingError, TypeCoercer } from '../index'
import { 
  createClass, 
  createNull,
  type BamlValueWithFlags,
  getConditions,
  score
} from '../../types'
import { DeserializerConditions, Flag } from '../../deserialize_flags'
import { coerceArrayToSingular } from '../array_helper'

/**
 * Coerce to class (object)
 */
export function coerceClass(
  ctx: ParsingContext,
  target: z.ZodObject<any>,
  value: Value | undefined,
  coercer: TypeCoercer
): BamlValueWithFlags | ParsingError {
  if (!value) {
    return ctx.errorUnexpectedNull(target)
  }

  const shape = target.shape
  const className = (target._def as any).description || 'Object'
  
  // Check for circular references
  let nestedCtx = ctx
  if (value) {
    const classValuePair = `${className}:${JSON.stringify(value)}`
    try {
      nestedCtx = ctx.visitClassValuePair(classValuePair, value)
    } catch (e) {
      if (e instanceof Error && e.message.includes('Circular reference')) {
        return ctx.errorCircularReference(className, value)
      }
      throw e
    }
  }

  // Partition fields into optional and required
  const fields = Object.entries(shape).map(([name, schema]) => ({
    name,
    schema: schema as z.ZodSchema,
    isOptional: schema instanceof z.ZodOptional || 
                schema instanceof z.ZodNullable ||
                schema instanceof z.ZodDefault
  }))
  
  const optionalFields = fields.filter(f => f.isOptional)
  const requiredFields = fields.filter(f => !f.isOptional)
  
  // Initialize field maps
  const fieldResults = new Map<string, BamlValueWithFlags | ParsingError | null>()
  fields.forEach(f => fieldResults.set(f.name, null))
  
  let flags = new DeserializerConditions()
  const completedInstances: Array<BamlValueWithFlags | ParsingError> = []

  // Process the value based on its type
  switch (value.type) {
    case 'object': {
      const providedFields = new Map(value.value)
      const extraKeys: Array<[string, Value]> = []
      let foundKeys = false
      
      // Try to match fields
      for (const [key, val] of value.value) {
        const field = fields.find(f => f.name === key.trim())
        if (field) {
          const fieldCtx = nestedCtx.enterScope(field.name)
          const result = coercer.coerce(fieldCtx, field.schema, val)
          fieldResults.set(field.name, result)
          foundKeys = true
        } else {
          extraKeys.push([key, val])
        }
      }
      
      // Handle single field case with implied key
      if (!foundKeys && extraKeys.length > 0 && fields.length === 1) {
        const field = fields[0]
        const fieldCtx = nestedCtx.enterScope(`<implied:${field.name}>`)
        const objValue: Value = { 
          type: 'object', 
          value: value.value, 
          completionState: value.completionState 
        }
        const result = coercer.coerce(fieldCtx, field.schema, objValue)
        
        if (!(result instanceof ParsingError)) {
          getConditions(result).addFlag(Flag.ImpliedKey, { key: field.name })
          fieldResults.set(field.name, result)
        } else {
          // Add extra keys as flags
          extraKeys.forEach(([key, val]) => {
            flags.addFlag(Flag.ExtraKey, { key, value: val })
          })
        }
      } else {
        // Add extra keys as flags
        extraKeys.forEach(([key, val]) => {
          flags.addFlag(Flag.ExtraKey, { key, value: val })
        })
      }
      break
    }
    
    case 'array': {
      // Try single field with array
      if (fields.length === 1) {
        const field = fields[0]
        const fieldCtx = nestedCtx.enterScope(`<implied:${field.name}>`)
        const result = coercer.coerce(fieldCtx, field.schema, value)
        
        if (!(result instanceof ParsingError)) {
          getConditions(result).addFlag(Flag.ImpliedKey, { key: field.name })
          fieldResults.set(field.name, result)
        }
      }
      
      // Try coercing array to singular class
      const singularResult = coerceArrayToSingular(
        ctx,
        target,
        value.value,
        (v) => coerceClass(ctx, target, v, coercer)
      )
      
      if (!(singularResult instanceof ParsingError)) {
        completedInstances.push(singularResult)
      }
      break
    }
    
    default: {
      // For other types, try single field with implied key
      if (fields.length === 1) {
        const field = fields[0]
        const fieldCtx = nestedCtx.enterScope(`<implied:${field.name}>`)
        const result = coercer.coerce(fieldCtx, field.schema, value)
        
        if (!(result instanceof ParsingError)) {
          getConditions(result).addFlag(Flag.ImpliedKey, { key: field.name })
          getConditions(result).addFlag(Flag.InferredObject, { value })
          fieldResults.set(field.name, result)
        }
      }
    }
  }
  
  // Process field results and handle defaults
  const finalFields = new Map<string, BamlValueWithFlags>()
  const unparsedRequired: Array<[string, ParsingError]> = []
  const missingRequired: string[] = []
  
  for (const field of fields) {
    const result = fieldResults.get(field.name)
    
    if (field.isOptional) {
      if (result instanceof ParsingError) {
        // Use default for optional field with error
        const defaultValue = createNull(field.schema.optional())
        getConditions(defaultValue).addFlag(Flag.DefaultButHadUnparseableValue, { error: result })
        getConditions(defaultValue).addFlag(Flag.Incomplete, undefined)
        finalFields.set(field.name, defaultValue)
      } else if (result === null) {
        // Missing optional field
        const defaultValue = createNull(field.schema.optional())
        getConditions(defaultValue).addFlag(Flag.OptionalDefaultFromNoValue, undefined)
        getConditions(defaultValue).addFlag(Flag.Pending, undefined)
        finalFields.set(field.name, defaultValue)
      } else if (result !== null) {
        finalFields.set(field.name, result)
      }
    } else {
      // Required field
      if (result instanceof ParsingError) {
        unparsedRequired.push([field.name, result])
      } else if (result === null) {
        // Check if field has default
        if (field.schema instanceof z.ZodDefault) {
          const defaultVal = field.schema._def.defaultValue()
          const valueFromDefault = jsToValue(defaultVal)
          const defaultResult = coercer.coerce(nestedCtx.enterScope(field.name), field.schema, valueFromDefault)
          
          if (!(defaultResult instanceof ParsingError)) {
            getConditions(defaultResult).addFlag(Flag.DefaultFromNoValue, undefined)
            getConditions(defaultResult).addFlag(Flag.Pending, undefined)
            finalFields.set(field.name, defaultResult)
          } else {
            missingRequired.push(field.name)
          }
        } else {
          missingRequired.push(field.name)
        }
      } else if (result !== null) {
        finalFields.set(field.name, result)
      }
    }
  }
  
  // Check if we have all required fields
  if (missingRequired.length > 0 || unparsedRequired.length > 0) {
    if (completedInstances.length === 0) {
      return ctx.errorMissingRequiredField(unparsedRequired, missingRequired, value)
    }
  } else {
    // Create the class instance
    const classInstance = createClass(className, finalFields, target, flags)
    
    // Add incomplete flag if needed
    if ('completionState' in value && value.completionState === CompletionState.Incomplete) {
      getConditions(classInstance).addFlag(Flag.Incomplete, undefined)
    }
    
    completedInstances.unshift(classInstance)
  }
  
  // Pick the best instance
  if (completedInstances.length === 0) {
    return ctx.errorUnexpectedType(target, value)
  }
  
  if (completedInstances.length === 1) {
    return completedInstances[0]
  }
  
  // Sort by score and return the best
  const scored = completedInstances
    .filter((inst): inst is BamlValueWithFlags => !(inst instanceof ParsingError))
    .map(inst => ({ inst, score: score(inst) }))
    .sort((a, b) => a.score - b.score)
  
  if (scored.length === 0) {
    return completedInstances[0] // Return first error
  }
  
  return scored[0].inst
}

// Helper to convert JS value to Value type
function jsToValue(val: any): Value | undefined {
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
      value: val.map(v => jsToValue(v)!).filter(v => v !== undefined),
      completionState: CompletionState.Complete
    }
  }
  if (typeof val === 'object') {
    const entries: Array<[string, Value]> = []
    for (const [k, v] of Object.entries(val)) {
      const value = jsToValue(v)
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