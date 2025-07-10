import { createParser } from './src/jsonish/parser'
import { z } from 'zod'
import { parse } from './src/jsonish/parser/entry'

const parser = createParser()

// Test comma-separated number
const input = '12,111'
const parsed = parse(input, {}, true)
console.log('Parsed value:', JSON.stringify(parsed, null, 2))

// Now try to parse with schema
try {
  const result = parser.parse(input, z.number())
  console.log('Result:', result)
} catch (e) {
  console.error('Error:', e)
}
