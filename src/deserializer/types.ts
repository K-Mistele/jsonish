// Mirrors Rust jsonish/src/deserializer/types.rs

import { z } from 'zod'
import type { CompletionState, Value } from '../jsonish/value'
import { DeserializerConditions, Flag, type FlagWithData } from './deserialize_flags'
import type { ParsingError } from './coercer'

// ValueWithFlags - a value with associated parsing metadata
export interface ValueWithFlags<T> {
  value: T
  target: z.ZodSchema
  flags: DeserializerConditions
}

// BamlValueWithFlags - represents parsed values with their parsing metadata
export type BamlValueWithFlags =
  | { type: 'string'; value: ValueWithFlags<string> }
  | { type: 'int'; value: ValueWithFlags<number> }
  | { type: 'float'; value: ValueWithFlags<number> }
  | { type: 'bool'; value: ValueWithFlags<boolean> }
  | { type: 'null'; target: z.ZodSchema; flags: DeserializerConditions }
  | { type: 'list'; flags: DeserializerConditions; target: z.ZodSchema; items: BamlValueWithFlags[] }
  | { type: 'map'; flags: DeserializerConditions; target: z.ZodSchema; items: Map<string, [DeserializerConditions, BamlValueWithFlags]> }
  | { type: 'enum'; name: string; target: z.ZodSchema; value: ValueWithFlags<string> }
  | { type: 'class'; name: string; flags: DeserializerConditions; target: z.ZodSchema; fields: Map<string, BamlValueWithFlags> }
  | { type: 'media'; target: z.ZodSchema; value: ValueWithFlags<{ mime: string; content: string }> }

// Alias for cleaner API
export type DeserializedValue = BamlValueWithFlags

// Helper functions for creating BamlValueWithFlags
export function createString(value: string, target: z.ZodSchema, flags?: DeserializerConditions): BamlValueWithFlags {
  return {
    type: 'string',
    value: {
      value,
      target,
      flags: flags || new DeserializerConditions()
    }
  }
}

export function createInt(value: number, target: z.ZodSchema, flags?: DeserializerConditions): BamlValueWithFlags {
  return {
    type: 'int',
    value: {
      value,
      target,
      flags: flags || new DeserializerConditions()
    }
  }
}

export function createFloat(value: number, target: z.ZodSchema, flags?: DeserializerConditions): BamlValueWithFlags {
  return {
    type: 'float',
    value: {
      value,
      target,
      flags: flags || new DeserializerConditions()
    }
  }
}

export function createBool(value: boolean, target: z.ZodSchema, flags?: DeserializerConditions): BamlValueWithFlags {
  return {
    type: 'bool',
    value: {
      value,
      target,
      flags: flags || new DeserializerConditions()
    }
  }
}

export function createNull(target: z.ZodSchema, flags?: DeserializerConditions): BamlValueWithFlags {
  return {
    type: 'null',
    target,
    flags: flags || new DeserializerConditions()
  }
}

export function createList(items: BamlValueWithFlags[], target: z.ZodSchema, flags?: DeserializerConditions): BamlValueWithFlags {
  return {
    type: 'list',
    flags: flags || new DeserializerConditions(),
    target,
    items
  }
}

export function createMap(
  items: Map<string, [DeserializerConditions, BamlValueWithFlags]>,
  target: z.ZodSchema,
  flags?: DeserializerConditions
): BamlValueWithFlags {
  return {
    type: 'map',
    flags: flags || new DeserializerConditions(),
    target,
    items
  }
}

export function createEnum(name: string, value: string, target: z.ZodSchema, flags?: DeserializerConditions): BamlValueWithFlags {
  return {
    type: 'enum',
    name,
    target,
    value: {
      value,
      target,
      flags: flags || new DeserializerConditions()
    }
  }
}

export function createClass(
  name: string,
  fields: Map<string, BamlValueWithFlags>,
  target: z.ZodSchema,
  flags?: DeserializerConditions
): BamlValueWithFlags {
  return {
    type: 'class',
    name,
    flags: flags || new DeserializerConditions(),
    target,
    fields
  }
}

export function createMedia(
  mime: string,
  content: string,
  target: z.ZodSchema,
  flags?: DeserializerConditions
): BamlValueWithFlags {
  return {
    type: 'media',
    target,
    value: {
      value: { mime, content },
      target,
      flags: flags || new DeserializerConditions()
    }
  }
}

// Helper to add a flag to a BamlValueWithFlags
export function addFlag(value: BamlValueWithFlags, flag: FlagWithData): void {
  switch (value.type) {
    case 'string':
    case 'int':
    case 'float':
    case 'bool':
    case 'media':
      value.value.flags.flags.push(flag)
      break
    case 'null':
    case 'list':
    case 'map':
    case 'class':
      value.flags.flags.push(flag)
      break
    case 'enum':
      value.value.flags.flags.push(flag)
      break
  }
}

// Get the target schema from a BamlValueWithFlags
export function getTarget(value: BamlValueWithFlags): z.ZodSchema {
  switch (value.type) {
    case 'string':
    case 'int':
    case 'float':
    case 'bool':
    case 'media':
      return value.value.target
    case 'null':
    case 'list':
    case 'map':
    case 'enum':
    case 'class':
      return value.target
  }
}

// Get the conditions from a BamlValueWithFlags
export function getConditions(value: BamlValueWithFlags): DeserializerConditions {
  switch (value.type) {
    case 'string':
    case 'int':
    case 'float':
    case 'bool':
    case 'media':
    case 'enum':
      return value.value.flags
    case 'null':
    case 'list':
    case 'map':
    case 'class':
      return value.flags
  }
}

// Calculate score for a BamlValueWithFlags
export function score(value: BamlValueWithFlags): number {
  let totalScore = 0
  
  switch (value.type) {
    case 'string':
    case 'int':
    case 'float':
    case 'bool':
    case 'media':
    case 'enum':
      totalScore += value.value.flags.score()
      break
    case 'null':
      totalScore += value.flags.score()
      break
    case 'list':
      totalScore += value.flags.score()
      totalScore += 10 * value.items.reduce((sum, item) => sum + score(item), 0)
      break
    case 'map':
      totalScore += value.flags.score()
      for (const [_, [conds, val]] of value.items) {
        totalScore += conds.score() + score(val)
      }
      break
    case 'class':
      totalScore += value.flags.score()
      totalScore += 10 * Array.from(value.fields.values()).reduce((sum, field) => sum + score(field), 0)
      break
  }
  
  return totalScore
}

// Check if a value is composite (object, array, etc)
export function isComposite(value: BamlValueWithFlags): boolean {
  switch (value.type) {
    case 'string':
    case 'int':
    case 'float':
    case 'bool':
    case 'null':
    case 'enum':
      return false
    case 'list':
    case 'map':
    case 'class':
    case 'media':
      return true
  }
}

// Convert BamlValueWithFlags to a plain JavaScript value
export function toPlainValue(value: BamlValueWithFlags): any {
  switch (value.type) {
    case 'string':
      return value.value.value
    case 'int':
    case 'float':
      return value.value.value
    case 'bool':
      return value.value.value
    case 'null':
      return null
    case 'list':
      return value.items.map(toPlainValue)
    case 'map':
      const obj: any = {}
      for (const [key, [_, val]] of value.items) {
        obj[key] = toPlainValue(val)
      }
      return obj
    case 'enum':
      return value.value.value
    case 'class':
      const classObj: any = {}
      for (const [key, val] of value.fields) {
        classObj[key] = toPlainValue(val)
      }
      return classObj
    case 'media':
      return value.value.value
  }
}

// Get string representation of the type
export function getTypeString(value: BamlValueWithFlags): string {
  switch (value.type) {
    case 'string':
      return 'String'
    case 'int':
      return 'Int'
    case 'float':
      return 'Float'
    case 'bool':
      return 'Bool'
    case 'null':
      return 'Null'
    case 'list':
      const itemTypes = new Set(value.items.map(getTypeString))
      const innerType = Array.from(itemTypes).join(' | ')
      return `List[${value.items.length}:${innerType}]`
    case 'map':
      return 'Map'
    case 'enum':
      return `Enum ${value.name}`
    case 'class':
      return `Class ${value.name}`
    case 'media':
      return 'Image'
  }
}

// Helper to create a simple value (for backwards compatibility)
export function createValue<T>(value: T, flags?: DeserializerConditions): DeserializedValue {
  // Determine the type and create appropriate BamlValueWithFlags
  if (value === null) {
    return createNull(z.null(), flags)
  } else if (typeof value === 'string') {
    return createString(value, z.string(), flags)
  } else if (typeof value === 'number') {
    return Number.isInteger(value) 
      ? createInt(value, z.number().int(), flags)
      : createFloat(value, z.number(), flags)
  } else if (typeof value === 'boolean') {
    return createBool(value, z.boolean(), flags)
  } else if (Array.isArray(value)) {
    // For arrays, we need to convert each item
    const items = value.map(v => createValue(v, new DeserializerConditions()))
    return createList(items, z.array(z.any()), flags)
  } else if (typeof value === 'object') {
    // For objects, create a class
    const fields = new Map<string, BamlValueWithFlags>()
    for (const [k, v] of Object.entries(value)) {
      fields.set(k, createValue(v, new DeserializerConditions()))
    }
    return createClass('Object', fields, z.object({}), flags)
  }
  
  // Fallback to string
  return createString(String(value), z.string(), flags)
}