import { fixJson } from './jsonish/src/fixing-parser.js';

const input = '{ rec_one: "and then i said \\"hi\\", and also \\"bye\\"", rec_two: "and then i said "hi", and also "bye"", "also_rec_one": ok }';

console.log('Original input:');
console.log(input);
console.log('\nFixed JSON:');

try {
  const fixed = fixJson(input);
  console.log(fixed);
  
  console.log('\nTrying to parse fixed JSON:');
  const parsed = JSON.parse(fixed);
  console.log('SUCCESS:', JSON.stringify(parsed, null, 2));
} catch (error) {
  console.log('FAILED:', error.message);
}

// Let's also try a manual fix
console.log('\n=== Manual fix attempt ===');
// The issue is: rec_two: "and then i said "hi", and also "bye""
// Should be: rec_two: "and then i said \"hi\", and also \"bye\""
const manualFix = input.replace(/"and then i said "hi", and also "bye""/, '"and then i said \\"hi\\", and also \\"bye\\""');
console.log('Manual fix:');
console.log(manualFix);

try {
  const parsed = JSON.parse(manualFix);
  console.log('Manual fix SUCCESS:', JSON.stringify(parsed, null, 2));
} catch (error) {
  console.log('Manual fix FAILED:', error.message);
}