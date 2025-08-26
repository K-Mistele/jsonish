import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createParser } from "../jsonish/src/index";

const parser = createParser();

describe("Unions", () => {
	// test_union - Basic union between Foo and Bar classes
	it("should parse basic union between Foo and Bar classes", () => {
		const fooSchema = z.object({
			hi: z.array(z.string()),
		});

		const barSchema = z.object({
			foo: z.string(),
		});

		const schema = z.union([fooSchema, barSchema]);
		const input = '{"hi": ["a", "b"]}';
		const expected = { hi: ["a", "b"] };

		const result = parser.parse(input, schema);
		expect(result).toEqual(expected);
	});

	// test_union_full - Union with array variant
	it("should parse union with array variant", () => {
		const fooSchema = z.object({
			hi: z.array(z.string()),
		});

		const barArraySchema = z.array(
			z.object({
				foo: z.string(),
			}),
		);

		const schema = z.union([fooSchema, barArraySchema]);
		const input = '{"hi": ["a", "b"]}';
		const expected = { hi: ["a", "b"] };

		const result = parser.parse(input, schema);
		expect(result).toEqual(expected);
	});

	// test_union2 - Discriminated union with CatAPicker/CatBPicker/CatCPicker
	it("should parse discriminated union with enum-based discrimination", () => {
		const catAPickerSchema = z.object({
			cat: z.enum(["A"]),
		});

		const catBPickerSchema = z.object({
			cat: z.enum(["C", "D"]),
			item: z.number(),
		});

		const catCPickerSchema = z.object({
			cat: z.enum(["E", "F", "G", "H", "I"]),
			item: z.union([z.number(), z.string(), z.null()]),
			data: z.number().optional(),
		});

		const schema = z.union([
			catAPickerSchema,
			catBPickerSchema,
			catCPickerSchema,
		]);
		const input = `\`\`\`json
  {
    "cat": "E",
    "item": "28558C",
    "data": null
  }
  \`\`\``;
		const expected = {
			cat: "E" as const,
			item: "28558C" as const,
			data: undefined,
		};

		const result = parser.parse(input, schema);
		expect(result).toEqual(expected);
	});

	// test_union3 - Complex union with RespondToUserAPI
	it("should parse complex union with RespondToUserAPI", () => {
		const assistantSchema = z.object({
			action: z.enum(["ETF", "Stock"]),
			instruction: z.string(),
			user_message: z.string(),
		});

		const askClarificationSchema = z.object({
			action: z.enum(["ASK_CLARIFICATION"]),
			question: z.string(),
		});

		const respondToUserSchema = z.object({
			action: z.enum(["RESPOND_TO_USER"]),
			sections: z.array(
				z.object({
					section_title: z.string(),
					type: z.array(
						z.enum([
							"CompanyBadge",
							"Markdown",
							"NumericalSlider",
							"BarGraph",
							"ScatterPlot",
						]),
					),
					content: z.object({
						richText: z
							.object({
								text: z.string(),
							})
							.optional(),
						companyBadge: z
							.object({
								name: z.string(),
								symbol: z.string(),
								logo_url: z.string(),
							})
							.optional(),
						numericalSlider: z
							.object({
								title: z.string(),
								min: z.number(),
								max: z.number(),
								value: z.number(),
							})
							.optional(),
						barGraph: z
							.array(
								z.object({
									name: z.string(),
									expected: z.number(),
									reported: z.number(),
								}),
							)
							.nullable()
							.optional(),
						scatterPlot: z
							.object({
								expected: z.array(
									z.object({
										x: z.string(),
										y: z.number(),
									}),
								),
								reported: z.array(
									z.object({
										x: z.string(),
										y: z.number(),
									}),
								),
							})
							.optional(),
						foo: z.string().optional(),
					}),
				}),
			),
		});

		const schema = z.union([
			respondToUserSchema,
			askClarificationSchema,
			z.array(assistantSchema),
		]);

		const input = `\`\`\`json
{
  "action": "RESPOND_TO_USER",
  "sections": [
    {
      "section_title": "NVIDIA Corporation (NVDA) Latest Earnings Summary",
      "type": ["CompanyBadge", "Markdown", "BarGraph"],
      "content": {
        "companyBadge": {
          "name": "NVIDIA Corporation",
          "symbol": "NVDA",
          "logo_url": "https://upload.wikimedia.org/wikipedia/en/thumb/2/21/Nvidia_logo.svg/1920px-Nvidia_logo.svg.png"
        },
        "richText": {
          "text": "### Key Metrics for the Latest Earnings Report (2024-08-28)\\n\\n- **Earnings Per Share (EPS):** $0.68\\n- **Estimated EPS:** $0.64\\n- **Revenue:** $30.04 billion\\n- **Estimated Revenue:** $28.74 billion\\n\\n#### Notable Highlights\\n- NVIDIA exceeded both EPS and revenue estimates for the quarter ending July 28, 2024.\\n- The company continues to show strong growth in its data center and gaming segments."
        },
        "barGraph": [
          {
            "name": "Earnings Per Share (EPS)",
            "expected": 0.64,
            "reported": 0.68
          },
          {
            "name": "Revenue (in billions)",
            "expected": 28.74,
            "reported": 30.04
          }
        ]
      }
    }
  ]
}
\`\`\``;

		const expected = {
			action: "RESPOND_TO_USER" as const,
			sections: [
				{
					section_title: "NVIDIA Corporation (NVDA) Latest Earnings Summary",
					type: ["CompanyBadge", "Markdown", "BarGraph"] as (
						| "CompanyBadge"
						| "Markdown"
						| "NumericalSlider"
						| "BarGraph"
						| "ScatterPlot"
					)[],
					content: {
						companyBadge: {
							name: "NVIDIA Corporation",
							symbol: "NVDA",
							logo_url:
								"https://upload.wikimedia.org/wikipedia/en/thumb/2/21/Nvidia_logo.svg/1920px-Nvidia_logo.svg.png",
						},
						richText: {
							text: "### Key Metrics for the Latest Earnings Report (2024-08-28)\n\n- **Earnings Per Share (EPS):** $0.68\n- **Estimated EPS:** $0.64\n- **Revenue:** $30.04 billion\n- **Estimated Revenue:** $28.74 billion\n\n#### Notable Highlights\n- NVIDIA exceeded both EPS and revenue estimates for the quarter ending July 28, 2024.\n- The company continues to show strong growth in its data center and gaming segments.",
						},
						scatterPlot: undefined,
						numericalSlider: undefined,
						barGraph: [
							{
								name: "Earnings Per Share (EPS)",
								expected: 0.64,
								reported: 0.68,
							},
							{
								name: "Revenue (in billions)",
								expected: 28.74,
								reported: 30.04,
							},
						],
						foo: undefined,
					},
				},
			],
		};

		const result = parser.parse(input, schema);
		expect(result).toEqual(expected);
	});

	// test_phone_number_regex and test_email_regex - Union with validation constraints
	it("should parse phone number in union with validation", () => {
		const phoneSchema = z.object({
			value: z.string().regex(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/),
		});

		const emailSchema = z.object({
			value: z.string().email(),
		});

		const contactSchema = z.object({
			primary: z.union([phoneSchema, emailSchema]),
		});

		const input = '{"primary": {"value": "908-797-8281"}}';
		const expected = { primary: { value: "908-797-8281" } };

		const result = parser.parse(input, contactSchema);
		expect(result).toEqual(expected);
	});

	it("should parse email in union with validation", () => {
		const phoneSchema = z.object({
			value: z.string().regex(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/),
		});

		const emailSchema = z.object({
			value: z.string().email(),
		});

		const contactSchema = z.object({
			primary: z.union([phoneSchema, emailSchema]),
		});

		const input = '{"primary": {"value": "help@boundaryml.com"}}';
		const expected = { primary: { value: "help@boundaryml.com" } };

		const result = parser.parse(input, contactSchema);
		expect(result).toEqual(expected);
	});

	// test_ignore_float_in_string_if_string_in_union - String preference over float
	it("should prefer string over float in union for ambiguous content", () => {
		const schema = z.union([z.number(), z.string()]);
		const input = "1 cup unsalted butter, room temperature";
		const expected = "1 cup unsalted butter, room temperature";

		const result = parser.parse(input, schema);
		expect(result).toEqual(expected);
	});

	// test_ignore_int_if_string_in_union - String preference over int
	it("should prefer string over int in union for ambiguous content", () => {
		const schema = z.union([z.number(), z.string()]);
		const input = "1 cup unsalted butter, room temperature";
		const expected = "1 cup unsalted butter, room temperature";

		const result = parser.parse(input, schema);
		expect(result).toEqual(expected);
	});

	// Additional test cases that were in the TypeScript file but not in Rust
	describe("Additional Union Type Tests", () => {
		it("should parse string from string|number union", () => {
			const schema = z.union([z.string(), z.number()]);
			const input = '"hello"';
			const expected = '"hello"';

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse number from string|number union", () => {
			const schema = z.union([z.string(), z.number()]);
			const input = "42";
			const expected = 42;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse boolean from string|boolean union", () => {
			const schema = z.union([z.string(), z.boolean()]);
			const input = "true";
			const expected = true;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse null from string|null union", () => {
			const schema = z.union([z.string(), z.null()]);
			const input = "null";
			const expected = null;

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle union with array types", () => {
			const schema = z.union([z.array(z.string()), z.array(z.number())]);

			const stringArrayResult = parser.parse('["a", "b", "c"]', schema);
			expect(stringArrayResult).toEqual(["a", "b", "c"]);

			const numberArrayResult = parser.parse("[1, 2, 3]", schema);
			expect(numberArrayResult).toEqual([1, 2, 3]);
		});

		it("should handle union with enum types", () => {
			const categoryASchema = z.enum(["A", "B"]);
			const categoryBSchema = z.enum(["C", "D"]);

			const schema = z.union([categoryASchema, categoryBSchema]);

			const resultA = parser.parse("A", schema);
			expect(resultA).toBe("A");

			const resultC = parser.parse("C", schema);
			expect(resultC).toBe("C");
		});
	});

	describe("Union Error Handling", () => {
		it("should handle malformed input gracefully", () => {
			const schema = z.union([z.string(), z.number()]);
			const input = "malformed{";

			// Should not throw and should return something reasonable
			expect(() => parser.parse(input, schema)).not.toThrow();
		});

		it("should handle empty input", () => {
			const schema = z.union([z.string(), z.number(), z.null()]);
			const input = "";

			// Should handle empty input gracefully
			expect(() => parser.parse(input, schema)).not.toThrow();
		});

		it("should handle input that matches no union member", () => {
			const schema = z.union([z.number(), z.boolean()]);
			const input = '"this is clearly a string"';

			// Should either coerce or handle gracefully
			expect(() => parser.parse(input, schema)).not.toThrow();
		});
	});
});
