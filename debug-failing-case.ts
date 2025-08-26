import { z } from 'zod';
import { fixJson, parseWithAdvancedFixing } from './jsonish/src/fixing-parser.js';
import { extractJsonFromText } from './jsonish/src/extractors.js';

// Test each strategy individually with the failing input
const input = '{ rec_one: "and then i said \\"hi\\", and also \\"bye\\"", rec_two: "and then i said "hi", and also "bye"", "also_rec_one": ok }';

console.log('Input:', input);

// Strategy 1: Standard JSON parsing
console.log('\n=== Strategy 1: Standard JSON parsing ===');
try {
  const parsed = JSON.parse(input);
  console.log('Success:', parsed);
} catch (error) {
  console.log('Failed:', error.message);
}

// Strategy 2: Extract JSON from text
console.log('\n=== Strategy 2: Extract JSON from text ===');
try {
  const extracted = extractJsonFromText(input);
  console.log('Extracted values:', extracted.length);
  for (let i = 0; i < extracted.length; i++) {
    console.log(`  Value ${i}:`, extracted[i]);
  }
} catch (error) {
  console.log('Failed:', error.message);
}

// Strategy 3: JSON fixing
console.log('\n=== Strategy 3: JSON fixing ===');
try {
  const fixed = fixJson(input);
  console.log('Fixed JSON:', fixed);
  if (fixed !== input) {
    const parsed = JSON.parse(fixed);
    console.log('Parsed fixed JSON:', parsed);
  }
} catch (error) {
  console.log('Failed:', error.message);
}

// Strategy 4: Advanced state machine parsing
console.log('\n=== Strategy 4: Advanced state machine parsing ===');
try {
  const { value } = parseWithAdvancedFixing(input);
  console.log('State machine result:', value);
} catch (error) {
  console.log('Failed:', error.message);
}