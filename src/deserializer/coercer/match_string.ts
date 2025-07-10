// Mirrors Rust jsonish/src/deserializer/coercer/match_string.rs

import { DeserializerConditions, Flag } from '../deserialize_flags'

// Simple string matching algorithm
export function matchString(expected: string, actual: string): boolean {
  // Exact match
  if (expected === actual) {
    return true
  }
  
  // Case-insensitive match
  if (expected.toLowerCase() === actual.toLowerCase()) {
    return true
  }
  
  // Substring match
  if (actual.includes(expected) || expected.includes(actual)) {
    return true
  }
  
  // Simple fuzzy match - check if all characters of expected are in actual in order
  let expectedIdx = 0
  for (let i = 0; i < actual.length && expectedIdx < expected.length; i++) {
    if (actual[i].toLowerCase() === expected[expectedIdx].toLowerCase()) {
      expectedIdx++
    }
  }
  
  return expectedIdx === expected.length
}

// Match one string from many options
export function matchOneFromMany(
  value: string,
  options: string[]
): { match: string; flags: DeserializerConditions } | null {
  const matches: Array<[string, number]> = []
  
  for (const option of options) {
    if (matchString(option, value)) {
      // Count how many characters match
      let matchCount = 0
      for (let i = 0; i < Math.min(value.length, option.length); i++) {
        if (value[i].toLowerCase() === option[i].toLowerCase()) {
          matchCount++
        }
      }
      matches.push([option, matchCount])
    }
  }
  
  if (matches.length === 0) {
    return null
  }
  
  // Sort by match quality (more matching characters is better)
  matches.sort((a, b) => b[1] - a[1])
  
  const flags = new DeserializerConditions()
  if (matches.length > 1) {
    flags.addFlag(Flag.StrMatchOneFromMany, { matches })
  }
  
  return { match: matches[0][0], flags }
}

// Strip non-alphanumeric characters and match
export function matchWithStripping(expected: string, actual: string): boolean {
  const strip = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return strip(expected) === strip(actual)
}