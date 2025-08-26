import { createParser } from './jsonish/src/index.js';
import { z } from 'zod';

const parser = createParser();

// Test the specific failing case - string with unescaped quotes
console.log('=== Testing string with unescaped quotes ===');
const schema = z.object({
  rec_one: z.string(),
  rec_two: z.string(),
  also_rec_one: z.string(),
});

const input = '{ rec_one: "and then i said \\"hi\\", and also \\"bye\\"", rec_two: "and then i said "hi", and also "bye"", "also_rec_one": ok }';

console.log('Input:', input);

try {
  const result = parser.parse(input, schema);
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.log('Error:', error);
  console.log('Error message:', error.message);
  if (error.issues) {
    console.log('Zod issues:', JSON.stringify(error.issues, null, 2));
  }
}

// Test nullable field case
console.log('\n=== Testing nullable field ===');
const nullableSchema = z.object({
  email: z.string().nullable(),
});

const nullableInput = '{"email": null}';
console.log('Nullable Input:', nullableInput);

try {
  const nullableResult = parser.parse(nullableInput, nullableSchema);
  console.log('Nullable Result:', JSON.stringify(nullableResult, null, 2));
  console.log('email value:', nullableResult.email);
  console.log('email type:', typeof nullableResult.email);
} catch (error) {
  console.log('Nullable Error:', error);
}

// Test recursive parsing
console.log('\n=== Testing recursive parsing ===');
const recursiveSchema: z.ZodSchema<{ pointer?: any | null }> = z.object({
  pointer: z.lazy(() => recursiveSchema).nullable().optional()
});

const recursiveInput = `The answer is
  {
    "pointer": {
      "pointer": null
    }
  },

  Anything else I can help with?`;

console.log('Recursive Input:', recursiveInput);
try {
  const recursiveResult = parser.parse(recursiveInput, recursiveSchema);
  console.log('Recursive Result:', JSON.stringify(recursiveResult, null, 2));
} catch (e) {
  console.error('Recursive Error:', e);
}