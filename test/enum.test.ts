import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createParser } from "../jsonish/src/index";

const parser = createParser();

describe("Enums", () => {
	describe("Basic Enum Parsing", () => {
		it("should parse enum value exactly", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = "TWO";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse enum value case-insensitively", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = "two";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse enum value with quotes", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = '"TWO"';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse enum from single item array", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = '["TWO"]';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse enum from multi-item array (take first)", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = '["TWO", "THREE"]';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Enum from String with Extra Text", () => {
		it("should extract enum with description prefix", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = '"ONE: The description of k1"';
			const expected = "ONE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract enum with case mismatch", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = "The answer is One";
			const expected = "ONE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract enum wrapped in markdown", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = "**one** is the answer";
			const expected = "ONE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle PascalCase enum with uppercase input", () => {
			const schema = z.enum(["One", "Two"]);
			const input = "**ONE** is the answer";
			const expected = "One";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract enum with description dash", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = '"ONE - The description of an enum value"';
			const expected = "ONE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract enum from quoted text", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = '"TWO" is one of the correct answers.';
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Enum Error Cases - Should Fail", () => {
		it("should fail on case insensitive ambiguous match", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = '"Two" is one of the correct answers.';

			expect(() => parser.parse(input, schema)).toThrow();
		});

		it("should fail when multiple enum values with punctuation 1", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = '"ONE - is the answer, not TWO"';

			expect(() => parser.parse(input, schema)).toThrow();
		});

		it("should fail when multiple enum values with punctuation 2", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = '"ONE. is the answer, not TWO"';

			expect(() => parser.parse(input, schema)).toThrow();
		});

		it("should fail when multiple enum values with punctuation 3", () => {
			const schema = z.enum(["ONE", "TWO"]);
			const input = '"ONE: is the answer, not TWO"';

			expect(() => parser.parse(input, schema)).toThrow();
		});
	});



	describe("Numerical Enums", () => {
		it("should handle numerical enum returning null when not found", () => {
			const schema = z.enum(["9325", "9465", "1040", "1040-X"]).optional();
			const input = `(such as 1040-X, 1040, etc.) or any payment vouchers.

Based on the criteria provided, this page does not qualify as a tax return form page. Therefore, the appropriate response is:

\`\`\`json
null
\`\`\` 

This indicates that there is no relevant tax return form type present on the page.`;

			const result = parser.parse(input, schema);
			expect(result).toBeUndefined();
		});

		it("should fail on ambiguous substring enum", () => {
			const schema = z.enum(["A", "B"]);
			const input = "The answer is not car or car-2!";

			expect(() => parser.parse(input, schema)).toThrow();
		});
	});

	describe("Complex Enum Scenarios", () => {
		it("should handle enum with special characters", () => {
			const schema = z.enum(["SPAM", "NOT_SPAM"]);
			const input = `The text "Buy cheap watches now! Limited time offer!!!" is typically characterized by unsolicited 
offers and urgency ($^{$_{Ω}$rel}$), which are common traits of spam messages. Therefore, it should be classified as:

- **SPAM**`;
			const expected = "SPAM";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle complex enum from string with streaming context", () => {
			const schema = z.enum(["SPAM", "NOT_SPAM"]);
			const input = `Classification: SPAM

The message exhibits characteristics commonly associated with unsolicited bulk communication. This classification applies when the content shows patterns of mass distribution without recipient consent.

### Characteristics of Spam
- **Bulk Distribution:** Messages sent to large numbers of recipients simultaneously
- **Unsolicited Content:** Communications not requested by the recipient
- **Commercial Intent:** Often contains promotional or advertising content

### Examples
- *"Limited time offer! Buy now and save 50%!"*
- *"You've won a prize! Click here to claim your reward!"*

### Long Description:
When a message demonstrates spam characteristics, it generally reflects commercial intent, mass distribution patterns, or unsolicited promotional content. This classification helps in filtering unwanted communications and maintaining inbox quality.

The message content might include urgent language, promotional offers, suspicious links, or other indicators commonly found in bulk marketing communications. Understanding these patterns is crucial for effective email filtering and user experience optimization.`;
			const expected = "SPAM";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});
});
