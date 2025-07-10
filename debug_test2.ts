import { parse } from './src/jsonish/parser/entry'
import { defaultParseOptions } from './src/jsonish/parser/entry'

// Test comma-separated number
const input = '12,111'
console.log('Options:', defaultParseOptions)

try {
  const parsed = parse(input, defaultParseOptions, true)
  console.log('Parsed value:', JSON.stringify(parsed, null, 2))
} catch (e) {
  console.error('Parse error:', e)
}
