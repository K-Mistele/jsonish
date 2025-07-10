// Mirrors Rust jsonish/src/deserializer/deserialize_flags.rs

import type { Value } from '../jsonish/value'
import type { ParsingError } from './coercer'
import type { BamlValueWithFlags } from './types'

// Enum representing various parsing flags
export enum Flag {
  // Object/Value transformations
  ObjectFromMarkdown,
  ObjectFromFixedJson,
  DefaultButHadUnparseableValue,
  ObjectToString,
  ObjectToPrimitive,
  ObjectToMap,
  ExtraKey,
  StrippedNonAlphaNumeric,
  SubstringMatch,
  SingleToArray,
  ArrayItemParseError,
  MapKeyParseError,
  MapValueParseError,
  JsonToString,
  ImpliedKey,
  InferredObject,
  
  // Match results
  FirstMatch,
  UnionMatch,
  StrMatchOneFromMany,
  
  // Default values
  DefaultFromNoValue,
  DefaultButHadValue,
  OptionalDefaultFromNoValue,
  
  // Type conversions
  StringToBool,
  StringToNull,
  StringToChar,
  StringToFloat,
  FloatToInt,
  
  // Other
  NoFields,
  ConstraintResults,
  Incomplete,
  Pending,
}

// Data associated with each flag type
export type FlagData = {
  [Flag.ObjectFromMarkdown]: { depth: number }
  [Flag.ObjectFromFixedJson]: { fixes: string[] }
  [Flag.DefaultButHadUnparseableValue]: { error: ParsingError }
  [Flag.ObjectToString]: { value: Value }
  [Flag.ObjectToPrimitive]: { value: Value }
  [Flag.ObjectToMap]: { value: Value }
  [Flag.ExtraKey]: { key: string; value: Value }
  [Flag.StrippedNonAlphaNumeric]: { original: string }
  [Flag.SubstringMatch]: { matched: string }
  [Flag.SingleToArray]: undefined
  [Flag.ArrayItemParseError]: { index: number; error: ParsingError }
  [Flag.MapKeyParseError]: { index: number; error: ParsingError }
  [Flag.MapValueParseError]: { key: string; error: ParsingError }
  [Flag.JsonToString]: { value: Value }
  [Flag.ImpliedKey]: { key: string }
  [Flag.InferredObject]: { value: Value }
  [Flag.FirstMatch]: { index: number; matches: Array<Result<BamlValueWithFlags, ParsingError>> }
  [Flag.UnionMatch]: { index: number; matches: Array<Result<BamlValueWithFlags, ParsingError>> }
  [Flag.StrMatchOneFromMany]: { matches: Array<[string, number]> }
  [Flag.DefaultFromNoValue]: undefined
  [Flag.DefaultButHadValue]: { value: Value }
  [Flag.OptionalDefaultFromNoValue]: undefined
  [Flag.StringToBool]: { original: string }
  [Flag.StringToNull]: { original: string }
  [Flag.StringToChar]: { original: string }
  [Flag.StringToFloat]: { original: string }
  [Flag.FloatToInt]: { original: number }
  [Flag.NoFields]: { value?: Value }
  [Flag.ConstraintResults]: { results: Array<[string, string, boolean]> }
  [Flag.Incomplete]: undefined
  [Flag.Pending]: undefined
}

// Result type helper
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

// Individual flag with associated data
export interface FlagWithData<T extends Flag = Flag> {
  flag: T
  data: FlagData[T]
}

// Class to manage deserializer conditions and flags
export class DeserializerConditions {
  public flags: FlagWithData[] = []

  constructor(flags: FlagWithData[] = []) {
    this.flags = flags
  }

  addFlag<T extends Flag>(flag: T, data: FlagData[T]): void {
    this.flags.push({ flag, data } as FlagWithData)
  }

  withFlag<T extends Flag>(flag: T, data: FlagData[T]): DeserializerConditions {
    const newConditions = new DeserializerConditions([...this.flags])
    newConditions.addFlag(flag, data)
    return newConditions
  }

  // Get parsing errors from flags
  explanation(): ParsingError[] {
    const errors: ParsingError[] = []
    
    for (const { flag, data } of this.flags) {
      switch (flag) {
        case Flag.ArrayItemParseError:
        case Flag.MapKeyParseError:
          errors.push((data as FlagData[Flag.ArrayItemParseError]).error)
          break
        case Flag.MapValueParseError:
          errors.push((data as FlagData[Flag.MapValueParseError]).error)
          break
        case Flag.DefaultButHadUnparseableValue:
          errors.push((data as FlagData[Flag.DefaultButHadUnparseableValue]).error)
          break
      }
    }
    
    return errors
  }

  // Get constraint results
  constraintResults(): Array<[string, string, boolean]> {
    for (const { flag, data } of this.flags) {
      if (flag === Flag.ConstraintResults) {
        return (data as FlagData[Flag.ConstraintResults]).results
      }
    }
    return []
  }

  // Score calculation for flags
  score(): number {
    let totalScore = 0
    
    for (const { flag, data } of this.flags) {
      switch (flag) {
        case Flag.InferredObject:
          totalScore += 0
          break
        case Flag.OptionalDefaultFromNoValue:
          totalScore += 1
          break
        case Flag.DefaultFromNoValue:
          totalScore += 100
          break
        case Flag.DefaultButHadValue:
          totalScore += 110
          break
        case Flag.ObjectFromFixedJson:
          totalScore += 0
          break
        case Flag.ObjectFromMarkdown:
          totalScore += (data as FlagData[Flag.ObjectFromMarkdown]).depth
          break
        case Flag.DefaultButHadUnparseableValue:
          totalScore += 2
          break
        case Flag.ObjectToMap:
        case Flag.ObjectToString:
        case Flag.ObjectToPrimitive:
          totalScore += 2
          break
        case Flag.ExtraKey:
        case Flag.SingleToArray:
          totalScore += 1
          break
        case Flag.StrippedNonAlphaNumeric:
          totalScore += 3
          break
        case Flag.SubstringMatch:
          totalScore += 2
          break
        case Flag.ImpliedKey:
        case Flag.JsonToString:
          totalScore += 2
          break
        case Flag.ArrayItemParseError:
          totalScore += 1 + (data as FlagData[Flag.ArrayItemParseError]).index
          break
        case Flag.MapKeyParseError:
        case Flag.MapValueParseError:
          totalScore += 1
          break
        case Flag.FirstMatch:
          totalScore += 1
          break
        case Flag.UnionMatch:
          totalScore += 0
          break
        case Flag.StrMatchOneFromMany:
          const matches = (data as FlagData[Flag.StrMatchOneFromMany]).matches
          totalScore += matches.reduce((sum, [_, count]) => sum + count, 0)
          break
        case Flag.StringToBool:
        case Flag.StringToNull:
        case Flag.StringToChar:
        case Flag.StringToFloat:
        case Flag.FloatToInt:
        case Flag.NoFields:
          totalScore += 1
          break
        case Flag.ConstraintResults:
        case Flag.Incomplete:
        case Flag.Pending:
          totalScore += 0
          break
      }
    }
    
    return totalScore
  }
}