import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createParser } from "../src/parser";

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

	describe("Enum Aliases", () => {
		// Note: These tests assume the parser supports alias-like matching
		// The actual implementation would need to handle the specific alias patterns

		it("should handle alias k1 for ONE", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "k1";
			const expected = "ONE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle complex alias for TWO", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "k-2-3.1_1";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle spaced alias for THREE", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "NUMBER THREE";
			const expected = "THREE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle alias without punctuation", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "number three";
			const expected = "THREE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle alias with modified punctuation", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "k-2-3 1_1";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle alias with description", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "k1: The description of enum value une";
			const expected = "ONE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle alias with whitespace description", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "k-2-3.1_1 The description of enum value deux";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle alias with period description", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "k-2-3.1_1. The description of enum value deux";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle alias within text", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "I would think k-2-3.1_1 is the best";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle multiple aliases with clear winner", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "k1 is the best! k-2-3.1_1 is bad. k1!";
			const expected = "ONE";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle multiple aliases with different winner", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "k1 is ok! k-2-3.1_1 is better. I would advise k-2-3.1_1!";
			const expected = "TWO";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should fail when too many alias ties", () => {
			const schema = z.enum(["ONE", "TWO", "THREE"]);
			const input = "k1 is the best! k-2-3.1_1 is bad. NUMBER_THREE!";

			expect(() => parser.parse(input, schema)).toThrow();
		});
	});

	describe("Enum Arrays with Aliases", () => {
		it("should parse array of enums with aliases", () => {
			const schema = z.array(z.enum(["ONE", "TWO", "THREE"]));
			const input = '["k1", "k-2-3.1_1"]';
			const expected: ("ONE" | "TWO" | "THREE")[] = ["ONE", "TWO"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse array of enums from markdown with aliases", () => {
			const schema = z.array(z.enum(["ONE", "TWO", "THREE"]));
			const input = `I would think something like this!
\`\`\`json    
[k1, "k-2-3.1_1", "NUMBER THREE"]
\`\`\``;
			const expected: ("ONE" | "TWO" | "THREE")[] = ["ONE", "TWO", "THREE"];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
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
			const input = ` \`k5\`

The category "k5: User is excited" is designed to identify and classify user inputs that express strong positive emotions, enthusiasm, or anticipation. This classification applies when the language used by the user conveys an eagerness or thrill about something they are experiencing or expecting.

### Characteristics of Excitement
- **Emotional Expressions:** The use of exclamation marks, emphatic words like "amazing," "incredible," or "fantastic."
- **Positive Language:** Use of positive adjectives and adverbs such as "can't wait," "thrilled," "excited," or "elated."
- **Anticipation:** Statements that show looking forward to an event, result, or item.
  
### Examples
- *"I can't wait for the concert tonight! It's going to be amazing!"*
- *"This new game release has me super excited. I've been waiting months for this!"*

### Long Description:
When a user demonstrates excitement in their communication, it generally reflects an emotional high, eagerness, or intense positivity regarding whatever they are discussing. This could pertain to events like attending a sports game or concert, receiving positive news or achievements, encountering something novel and stimulating (like a new gadget or experience), or anticipating something eagerly awaited.

The user's input might include dynamic language that conveys an elevated state of anticipation or satisfaction with an imminent or forthcoming occurrence. Often associated with increased energy levels in the text itself—through phrases like "so excited!" or actions ("counting down until") — this category taps into the positive psychology aspects, depicting a scenario where the user feels joyous eagerness and anticipatory pleasure.

Understanding excitement is crucial because it can drive engagement, motivation, and personal enthusiasm which might influence decision-making and behavior. Recognizing exciting expressions helps in tailoring responses or actions that resonate with the user's emotional state, maintaining an enthusiastic interaction, and potentially amplifying positive outcomes.`;
			const expected = "SPAM";

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});
});
