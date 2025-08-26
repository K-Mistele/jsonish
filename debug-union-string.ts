import { createParser } from "./jsonish/src/index.js";
import { z } from "zod";

const parser = createParser();

// Test string in union
const schema = z.union([z.string(), z.number()]);
const input1 = '"hello"';
const result1 = parser.parse(input1, schema);
console.log("Input:", JSON.stringify(input1), "Result:", JSON.stringify(result1));

// Test number in union
const input2 = "42";
const result2 = parser.parse(input2, schema);
console.log("Input:", JSON.stringify(input2), "Result:", JSON.stringify(result2));

// Test just string schema
const stringSchema = z.string();
const result3 = parser.parse(input1, stringSchema);
console.log("String schema - Input:", JSON.stringify(input1), "Result:", JSON.stringify(result3));