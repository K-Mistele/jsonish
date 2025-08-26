import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createParser } from "../jsonish/src/index";

const parser = createParser();

describe("Literals", () => {
	describe("Basic Literal Tests", () => {
		it("should parse positive integer literal", () => {
			const schema = z.literal(2);
			const input = "2";
			const expected = 2;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse negative integer literal", () => {
			const schema = z.literal(-42);
			const input = "-42";
			const expected = -42;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse zero literal", () => {
			const schema = z.literal(0);
			const input = "0";
			const expected = 0;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse boolean true literal", () => {
			const schema = z.literal(true);
			const input = "true";
			const expected = true;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse boolean false literal", () => {
			const schema = z.literal(false);
			const input = "false";
			const expected = false;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("String Literal Tests with Case Coercion", () => {
		it("should parse uppercase string with double quotes", () => {
			const schema = z.literal("TWO");
			const input = '"TWO"';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse uppercase string without quotes", () => {
			const schema = z.literal("TWO");
			const input = "TWO";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse string with mismatched case (case coercion)", () => {
			const schema = z.literal("TWO");
			const input = "Two";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse lowercase string and coerce to uppercase", () => {
			const schema = z.literal("TWO");
			const input = "two";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Text Extraction Tests", () => {
		it("should extract literal from text preceded by extra text", () => {
			const schema = z.literal("TWO");
			const input = "The answer is TWO";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract literal from text with case mismatch", () => {
			const schema = z.literal("TWO");
			const input = "The answer is Two";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract literal from text followed by extra text", () => {
			const schema = z.literal("TWO");
			const input = "TWO is the answer";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract literal from text followed by extra text with case mismatch", () => {
			const schema = z.literal("TWO");
			const input = "Two is the answer";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Quote Position Tests", () => {
		it("should extract quoted literal preceded by extra text", () => {
			const schema = z.literal("TWO");
			const input = 'The answer is "TWO"';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract quoted literal preceded by extra text with case mismatch", () => {
			const schema = z.literal("TWO");
			const input = 'The answer is "two"';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract quoted literal followed by extra text", () => {
			const schema = z.literal("TWO");
			const input = '"TWO" is the answer';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract quoted literal followed by extra text with case mismatch", () => {
			const schema = z.literal("TWO");
			const input = '"Two" is the answer';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Special Cases", () => {
		it("should handle case mismatch in complex text (upper in text, lower expected)", () => {
			const schema = z.literal("two");
			const input = 'The ansewr "TWO" is the correct one';
			const expected = "two";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle literal with special characters", () => {
			const schema = z.literal("TWO");
			const input = '"TWO!@#"';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle literal with whitespace", () => {
			const schema = z.literal("TWO");
			const input = '"  TWO  "';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Union Literal Tests", () => {
		it("should parse union literal integer", () => {
			const schema = z.union([z.literal(2), z.literal(3)]);
			const input = "2";
			const expected = 2;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle ambiguous union with both literals (should fail)", () => {
			const schema = z.union([z.literal(2), z.literal(3)]);
			const input = "2 or 3";

			// This should fail due to ambiguity
			expect(() => parser.parse(input, schema)).toThrow();
		});

		it("should handle ambiguous boolean union (should fail)", () => {
			const schema = z.union([z.literal(2), z.literal(3)]);
			const input = "true or false";

			// This should fail due to ambiguity
			expect(() => parser.parse(input, schema)).toThrow();
		});

		it("should handle ambiguous string union (picks first match)", () => {
			const schema = z.union([z.literal("TWO"), z.literal("THREE")]);
			const input = "TWO or THREE";
			const expected = "TWO"; // Should pick the first match

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Object Single Value Extraction Tests", () => {
		it("should extract integer from object with single key", () => {
			const schema = z.union([
				z.literal(1),
				z.literal(true),
				z.literal("THREE"),
			]);
			const input = `{
        "status": 1
      }`;
			const expected = 1;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract integer from object (duplicate test)", () => {
			const schema = z.union([
				z.literal(1),
				z.literal(true),
				z.literal("THREE"),
			]);
			const input = `{
        "status": 1
      }`;
			const expected = 1;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract boolean from object with single key", () => {
			const schema = z.union([
				z.literal(1),
				z.literal(true),
				z.literal("THREE"),
			]);
			const input = `{
        "result": true
      }`;
			const expected = true;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract string from object with single key", () => {
			const schema = z.union([
				z.literal(1),
				z.literal(true),
				z.literal("THREE"),
			]);
			const input = `{
        "value": "THREE"
      }`;
			const expected = "THREE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Ambiguity Tests", () => {
		it("should handle complete string vs substring ambiguity", () => {
			const schema = z.union([
				z.literal("pay"),
				z.literal("pay_without_credit_card"),
			]);
			const input = `
        "pay"
      `;
			const expected = "pay";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle incomplete string ambiguity (streaming failure)", () => {
			const schema = z.union([
				z.literal("pay"),
				z.literal("pay_without_credit_card"),
			]);
			const input = `
        "pay
      `;

			// This should fail due to incomplete streaming
			expect(() => parser.parse(input, schema)).toThrow();
		});
	});

	describe("Object Edge Cases (Should Fail)", () => {
		it("should fail with object having multiple keys", () => {
			const schema = z.union([
				z.literal(1),
				z.literal(true),
				z.literal("THREE"),
			]);
			const input = `{
        "status": 1,
        "message": "success"
      }`;

			// Should fail because object has multiple keys
			expect(() => parser.parse(input, schema)).toThrow();
		});

		it("should fail with nested object", () => {
			const schema = z.union([
				z.literal(1),
				z.literal(true),
				z.literal("THREE"),
			]);
			const input = `{
        "status": {
          "code": 1
        }
      }`;

			// Should fail because object is nested
			expect(() => parser.parse(input, schema)).toThrow();
		});

		it("should fail with object containing array", () => {
			const schema = z.union([
				z.literal(1),
				z.literal(true),
				z.literal("THREE"),
			]);
			const input = `{
        "values": [1]
      }`;

			// Should fail because object contains array
			expect(() => parser.parse(input, schema)).toThrow();
		});
	});

	describe("Quote Handling Tests", () => {
		it("should handle quoted string in object", () => {
			const schema = z.union([
				z.literal(1),
				z.literal(true),
				z.literal("THREE"),
			]);
			const input = `{
        "value": "\\"THREE\\""
      }`;
			const expected = "THREE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract literal from object with extra text", () => {
			const schema = z.union([
				z.literal(1),
				z.literal(true),
				z.literal("THREE"),
			]);
			const input = `{
        "value": "The answer is THREE"
      }`;
			const expected = "THREE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Partial Tests", () => {
		it("should handle partial class with null literal", () => {
			const schema = z.object({
				bar: z.literal("hello").optional().nullable(),
			});
			const input = "{}";
			const expected = { bar: null };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});
});
