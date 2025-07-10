// Mirrors Rust jsonish/src/deserializer/coercer/mod.rs

import { z } from 'zod'
import type { Value } from '../../jsonish/value'
import type { DeserializedValue } from '../types'

// Export all coercer modules
export * from './field_type'
export * from './coerce_primitive'
export * from './coerce_array'
export * from './coerce_literal'
export * from './coerce_map'
export * from './coerce_union'
export * from './array_helper'
export * from './match_string'
export * from './ir_ref'

// Parsing error type
export class ParsingError extends Error {
  public scope: string[]
  public reason: string
  public causes: ParsingError[]

  constructor(reason: string, scope: string[] = [], causes: ParsingError[] = []) {
    super(reason)
    this.name = 'ParsingError'
    this.scope = scope
    this.reason = reason
    this.causes = causes
  }

  toString(): string {
    const scopeStr = this.scope.length === 0 ? '<root>' : this.scope.join('.')
    let result = `${scopeStr}: ${this.reason}`
    
    for (const cause of this.causes) {
      const causeStr = cause.toString().split('\n').map(line => `  ${line}`).join('\n')
      result += `\n  - ${causeStr}`
    }
    
    return result
  }
}

// Parsing context
export class ParsingContext {
  public scope: string[]
  private visited: Set<string>

  constructor(scope: string[] = []) {
    this.scope = scope
    this.visited = new Set()
  }

  displayScope(): string {
    return this.scope.length === 0 ? '<root>' : this.scope.join('.')
  }

  enterScope(scope: string): ParsingContext {
    const newContext = new ParsingContext([...this.scope, scope])
    newContext.visited = new Set(this.visited)
    return newContext
  }

  visitClassValuePair(className: string, value: Value): ParsingContext {
    const key = `${className}:${JSON.stringify(value)}`
    if (this.visited.has(key)) {
      throw this.errorCircularReference(className, value)
    }
    const newContext = new ParsingContext([...this.scope])
    newContext.visited = new Set(this.visited)
    newContext.visited.add(key)
    return newContext
  }

  // Error helper methods
  errorTooManyMatches(target: z.ZodSchema, options: string[]): ParsingError {
    return new ParsingError(
      `Too many matches for ${this.getSchemaName(target)}. Got: ${options.join(', ')}`,
      this.scope
    )
  }

  errorMergeMultiple(summary: string, errors: ParsingError[]): ParsingError {
    return new ParsingError(summary, this.scope, errors)
  }

  errorUnexpectedEmptyArray(target: z.ZodSchema): ParsingError {
    return new ParsingError(
      `Expected ${this.getSchemaName(target)}, got empty array`,
      this.scope
    )
  }

  errorUnexpectedNull(target: z.ZodSchema): ParsingError {
    return new ParsingError(
      `Expected ${this.getSchemaName(target)}, got null`,
      this.scope
    )
  }

  errorImageNotSupported(): ParsingError {
    return new ParsingError('Image type is not supported here', this.scope)
  }

  errorAudioNotSupported(): ParsingError {
    return new ParsingError('Audio type is not supported here', this.scope)
  }

  errorMapMustHaveSupportedKey(keyType: z.ZodSchema): ParsingError {
    return new ParsingError(
      `Maps may only have strings, enums or literal strings for keys, but got ${this.getSchemaName(keyType)}`,
      this.scope
    )
  }

  errorMissingRequiredField(
    unparsed: Array<[string, ParsingError]>,
    missing: string[],
    item?: Value
  ): ParsingError {
    const causes: ParsingError[] = []
    
    for (const field of missing) {
      causes.push(new ParsingError(`Missing required field: ${field}`, this.scope))
    }
    
    for (const [field, error] of unparsed) {
      causes.push(new ParsingError(`Failed to parse field ${field}: ${error.reason}`, this.scope, [error]))
    }
    
    return new ParsingError(
      `Failed while parsing required fields: missing=${missing.length}, unparsed=${unparsed.length}`,
      this.scope,
      causes
    )
  }

  errorUnexpectedType(target: z.ZodSchema, got: Value | string): ParsingError {
    const targetStr = this.getSchemaName(target)
    const gotStr = typeof got === 'string' ? got : got.type
    
    return new ParsingError(
      `Expected ${targetStr}, got ${gotStr}.`,
      this.scope
    )
  }

  errorInternal(error: string): ParsingError {
    return new ParsingError(`Internal error: ${error}`, this.scope)
  }

  errorCircularReference(className: string, value: Value): ParsingError {
    return new ParsingError(
      `Circular reference detected for class-value pair ${className} <-> ${JSON.stringify(value)}`,
      this.scope
    )
  }

  // Helper to get a readable name for a Zod schema
  private getSchemaName(schema: z.ZodSchema): string {
    if (schema instanceof z.ZodString) return 'string'
    if (schema instanceof z.ZodNumber) return 'number'
    if (schema instanceof z.ZodBoolean) return 'boolean'
    if (schema instanceof z.ZodNull) return 'null'
    if (schema instanceof z.ZodArray) return 'array'
    if (schema instanceof z.ZodObject) return 'object'
    if (schema instanceof z.ZodUnion) return 'union'
    if (schema instanceof z.ZodEnum) return 'enum'
    if (schema instanceof z.ZodLiteral) return 'literal'
    if (schema instanceof z.ZodRecord) return 'record'
    if (schema instanceof z.ZodOptional) return `${this.getSchemaName(schema.unwrap())} | null`
    return 'unknown'
  }
}

// Type coercer interface
export interface TypeCoercer {
  coerce(
    ctx: ParsingContext,
    target: z.ZodSchema,
    value: Value | undefined
  ): DeserializedValue | ParsingError
}

// Default value interface
export interface DefaultValue {
  defaultValue(error?: ParsingError): DeserializedValue | null
}