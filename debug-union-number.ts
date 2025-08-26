import { createParser } from "./jsonish/src/index.js";
import { z } from "zod";

const parser = createParser();
const schema = z.union([z.string(), z.number()]);

console.log("=== Testing Number in Union ===");
const input = "42";
console.log("Input:", JSON.stringify(input));
const result = parser.parse(input, schema);
console.log("Union result:", JSON.stringify(result), typeof result);