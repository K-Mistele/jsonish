import { createParser } from "./jsonish/src/index.js";
import { z } from "zod";
import { createStringValue } from "./jsonish/src/value.js";

const parser = createParser();

// Debug what value.value contains
const input = '"hello"';
const stringValue = createStringValue(input);
console.log("Original input:", JSON.stringify(input));
console.log("StringValue.value:", JSON.stringify(stringValue.value));
console.log("StringValue.type:", stringValue.type);

// Test what z.string().parse does with different inputs
const schema = z.string();
console.log("z.string().parse(input):", JSON.stringify(schema.parse(input)));
try {
  console.log("z.string().parse(stringValue.value):", JSON.stringify(schema.parse(stringValue.value)));
} catch (e) {
  console.log("z.string().parse(stringValue.value) failed:", e.message);
}