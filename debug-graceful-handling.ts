import { createParser } from "./jsonish/src/index.js";
import { z } from "zod";

const parser = createParser();

console.log("=== Testing Graceful Union Error Handling ===");

// Test the failing case
const schema = z.union([z.number(), z.boolean()]);
const input = '"this is clearly a string"';

console.log("Schema:", "z.union([z.number(), z.boolean()])");
console.log("Input:", JSON.stringify(input));

try {
  const result = parser.parse(input, schema);
  console.log("Result:", JSON.stringify(result), typeof result);
  console.log("SUCCESS - did not throw!");
} catch (e) {
  console.log("FAILED - threw error:", e.message);
}