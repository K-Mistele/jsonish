import { createParser } from './src/jsonish/parser'
import { z } from 'zod'
import { deserialize } from './src/deserializer'
import { toPlainValue } from './src/deserializer/types'
import { parse, defaultParseOptions } from './src/jsonish/parser/entry'

// Test comma-separated number
const input = '12,111'
const parsed = parse(input, defaultParseOptions, true)
console.log('Parsed value:', JSON.stringify(parsed, null, 2))

// Try deserializing
const result = deserialize(parsed, z.number())
console.log('Deserialized result:', result)

if (result && 'type' in result) {
  const plain = toPlainValue(result)
  console.log('Plain value:', plain)
}
