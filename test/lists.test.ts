import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createParser } from "../src/parser";

const parser = createParser();

describe("Arrays", () => {
	// Direct mappings from Rust test_lists.rs
	describe("Rust Test Mappings", () => {
		// test_list - Basic string array
		it("should parse basic string array (test_list)", () => {
			const schema = z.array(z.string());
			const input = '["a", "b"]';
			const expected = ["a", "b"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		// test_list_with_quotes - String array with escaped quotes
		it("should parse string array with escaped quotes (test_list_with_quotes)", () => {
			const schema = z.array(z.string());
			const input = '[""a"", ""b""]';
			const expected = ['"a"', '"b"'];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		// test_list_with_extra_text - Array extraction from text
		it("should extract array from text with suffix (test_list_with_extra_text)", () => {
			const schema = z.array(z.string());
			const input = '["a", "b"] is the output.';
			const expected = ["a", "b"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		// test_list_with_invalid_extra_text - Unquoted array extraction
		it("should extract unquoted array from text (test_list_with_invalid_extra_text)", () => {
			const schema = z.array(z.string());
			const input = "[a, b] is the output.";
			const expected = ["a", "b"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		// test_list_object_from_string - Array of objects with class Foo
		it("should parse array of objects (test_list_object_from_string)", () => {
			const schema = z.array(
				z.object({
					a: z.number(),
					b: z.string(),
				}),
			);
			const input = '[{"a": 1, "b": "hello"}, {"a": 2, "b": "world"}]';
			const expected = [
				{ a: 1, b: "hello" },
				{ a: 2, b: "world" },
			];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		// test_class_list - Array of transaction objects with class ListClass
		it("should parse array of transaction objects (test_class_list)", () => {
			const schema = z.array(
				z.object({
					date: z.string(),
					description: z.string(),
					transaction_amount: z.number(),
					transaction_type: z.string(),
				}),
			);
			const input = `[
        {
          "date": "01/01",
          "description": "Transaction 1",
          "transaction_amount": -100.00,
          "transaction_type": "Withdrawal"
        },
        {
          "date": "01/02",
          "description": "Transaction 2",
          "transaction_amount": -2,000.00,
          "transaction_type": "Withdrawal"
        },
        {
          "date": "01/03",
          "description": "Transaction 3",
          "transaction_amount": -300.00,
          "transaction_type": "Withdrawal"
        },
        {
          "date": "01/04",
          "description": "Transaction 4",
          "transaction_amount": -4,000.00,
          "transaction_type": "Withdrawal"
        },
        {
          "date": "01/05",
          "description": "Transaction 5",
          "transaction_amount": -5,000.00,
          "transaction_type": "Withdrawal"
        }
      ]`;
			const expected = [
				{
					date: "01/01",
					description: "Transaction 1",
					transaction_amount: -100.0,
					transaction_type: "Withdrawal",
				},
				{
					date: "01/02",
					description: "Transaction 2",
					transaction_amount: -2000.0,
					transaction_type: "Withdrawal",
				},
				{
					date: "01/03",
					description: "Transaction 3",
					transaction_amount: -300.0,
					transaction_type: "Withdrawal",
				},
				{
					date: "01/04",
					description: "Transaction 4",
					transaction_amount: -4000.0,
					transaction_type: "Withdrawal",
				},
				{
					date: "01/05",
					description: "Transaction 5",
					transaction_amount: -5000.0,
					transaction_type: "Withdrawal",
				},
			];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		// test_list_streaming - Incomplete array parsing
		it("should parse incomplete array (test_list_streaming)", () => {
			const schema = z.array(z.number());
			const input = "[1234, 5678";
			const expected = [1234, 5678];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		// test_list_streaming_2 - Incomplete array with single item
		it("should parse incomplete array with single item (test_list_streaming_2)", () => {
			const schema = z.array(z.number());
			const input = "[1234";
			const expected = [1234];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Basic Array Parsing", () => {
		it("should parse an array of integers", () => {
			const schema = z.array(z.number());
			const input = "[1, 2, 3]";
			const expected = [1, 2, 3];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse an array of strings", () => {
			const schema = z.array(z.string());
			const input = '["hello", "world", "test"]';
			const expected = ["hello", "world", "test"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse an array of booleans", () => {
			const schema = z.array(z.boolean());
			const input = "[true, false, true]";
			const expected = [true, false, true];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse an empty array", () => {
			const schema = z.array(z.string());
			const input = "[]";
			const expected: string[] = [];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Type Coercion in Arrays", () => {
		it("should coerce numbers to strings in string array", () => {
			const schema = z.array(z.string());
			const input = "[1, 2, 3]";
			const expected = ["1", "2", "3"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should coerce strings to numbers in number array", () => {
			const schema = z.array(z.number());
			const input = '["1", "2", "3"]';
			const expected = [1, 2, 3];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should coerce mixed types to floats", () => {
			const schema = z.array(z.number());
			const input = '[1, 2.5, "3"]';
			const expected = [1, 2.5, 3];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Single Value to Array Coercion", () => {
		it("should wrap single string in array when expecting string array", () => {
			const schema = z.array(z.string());
			const input = '"hello"';
			const expected = ["hello"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should wrap single number in array when expecting number array", () => {
			const schema = z.array(z.number());
			const input = "42";
			const expected = [42];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should wrap single boolean in array when expecting boolean array", () => {
			const schema = z.array(z.boolean());
			const input = "true";
			const expected = [true];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract boolean from text into array", () => {
			const schema = z.array(z.boolean());
			const input = "The answer is true";
			const expected = [true];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Nested Arrays", () => {
		it("should parse nested number arrays", () => {
			const schema = z.array(z.array(z.number()));
			const input = "[[1, 2], [3, 4], [5, 6]]";
			const expected = [
				[1, 2],
				[3, 4],
				[5, 6],
			];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse nested string arrays", () => {
			const schema = z.array(z.array(z.string()));
			const input = '[["a", "b"], ["c", "d"]]';
			const expected = [
				["a", "b"],
				["c", "d"],
			];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle deeply nested arrays", () => {
			const schema = z.array(z.array(z.array(z.number())));
			const input = "[[[1]], [[2, 3]], [[4, 5, 6]]]";
			const expected = [[[1]], [[2, 3]], [[4, 5, 6]]];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Malformed Array Handling", () => {
		it("should handle array with trailing comma", () => {
			const schema = z.array(z.number());
			const input = "[1, 2, 3,]";
			const expected = [1, 2, 3];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle array with unquoted strings", () => {
			const schema = z.array(z.string());
			const input = "[hello, world, test]";
			const expected = ["hello", "world", "test"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle array with mixed quotes", () => {
			const schema = z.array(z.string());
			const input = "[\"hello\", 'world', test]";
			const expected = ["hello", "world", "test"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Union Arrays", () => {
		it("should parse array of string or number union", () => {
			const schema = z.array(z.union([z.string(), z.number()]));
			const input = '["hello", 42, "world", 123]';
			const expected = ["hello", 42, "world", 123];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse array of object unions", () => {
			const schema = z.array(
				z.union([
					z.object({ type: z.literal("text"), content: z.string() }),
					z.object({ type: z.literal("number"), value: z.number() }),
				]),
			);
			const input =
				'[{"type": "text", "content": "hello"}, {"type": "number", "value": 42}]';
			const expected = [
				{ type: "text" as const, content: "hello" },
				{ type: "number" as const, value: 42 },
			];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Arrays from Mixed Content", () => {
		it("should extract array from text with prefix", () => {
			const schema = z.array(z.number());
			const input = "Here are the numbers: [1, 2, 3]";
			const expected = [1, 2, 3];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract array from markdown code block", () => {
			const schema = z.array(z.string());
			const input = `
        Here's the array:
        \`\`\`json
        ["apple", "banana", "cherry"]
        \`\`\`
      `;
			const expected = ["apple", "banana", "cherry"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle multiple arrays in text (choose first)", () => {
			const schema = z.array(z.number());
			const input = "First array: [1, 2, 3] and second array: [4, 5, 6]";
			const expected = [1, 2, 3];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});
});
