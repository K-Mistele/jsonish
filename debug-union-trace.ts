import { createParser } from "./jsonish/src/index.js";
import { z } from "zod";

// Let's trace what happens in union resolution

const parser = createParser();
const schema = z.union([z.string(), z.number()]);
const input = '"hello"';

console.log("=== Testing Union Resolution ===");
console.log("Input:", JSON.stringify(input));

// Let's see what happens with each option individually
const stringSchema = z.string();
const numberSchema = z.number();

console.log("String schema result:", JSON.stringify(parser.parse(input, stringSchema)));

try {
  console.log("Number schema result:", JSON.stringify(parser.parse(input, numberSchema)));
} catch (e) {
  console.log("Number schema failed:", e.message);
}

console.log("Union result:", JSON.stringify(parser.parse(input, schema)));