import { createParser } from "./jsonish/src/index.js";
import { z } from "zod";

const parser = createParser();

console.log("=== Testing Array Union Resolution ===");

// Test the specific failing case
const schema = z.union([z.array(z.string()), z.array(z.number())]);
const input = "[1, 2, 3]";
console.log("Input:", JSON.stringify(input));

// Test each option individually first
const stringArraySchema = z.array(z.string());
const numberArraySchema = z.array(z.number());

try {
  const stringResult = parser.parse(input, stringArraySchema);
  console.log("String array result:", JSON.stringify(stringResult));
} catch (e) {
  console.log("String array failed:", e.message);
}

try {
  const numberResult = parser.parse(input, numberArraySchema);
  console.log("Number array result:", JSON.stringify(numberResult));
} catch (e) {
  console.log("Number array failed:", e.message);
}

// Test the union
const unionResult = parser.parse(input, schema);
console.log("Union result:", JSON.stringify(unionResult));