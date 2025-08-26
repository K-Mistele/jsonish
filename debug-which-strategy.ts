import { z } from 'zod';
import { createParser } from './jsonish/src/index.ts';

// Add debug logging to see which strategy is being used
const original_console_log = console.log;
let strategyUsed = '';

console.log = (...args) => {
  const message = args.join(' ');
  if (message.includes('Strategy')) {
    strategyUsed = message;
  }
  return original_console_log.apply(console, args);
};

const parser = createParser();

const schema = z.object({
  rec_one: z.string(),
  rec_two: z.string(),
  also_rec_one: z.string(),
});

const input = '{ rec_one: "and then i said \\"hi\\", and also \\"bye\\"", rec_two: "and then i said "hi", and also "bye"", "also_rec_one": ok }';

console.log('Input:', input);

try {
  const result = parser.parse(input, schema);
  console.log('Strategy used:', strategyUsed);
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.log('Strategy used before error:', strategyUsed);
  console.log('Error:', error);
}