import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createParser } from "../src/parser";

const parser = createParser();

describe("Objects", () => {
	describe("Basic Object Parsing", () => {
		it("should parse a simple object with string array", () => {
			const schema = z.object({
				hi: z.array(z.string()),
			});
			const input = '{"hi": ["a", "b"]}';
			const expected = { hi: ["a", "b"] };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should wrap objects in array when expected", () => {
			const schema = z.array(
				z.object({
					hi: z.array(z.string()),
				}),
			);
			const input = '{"hi": "a"}';
			const expected = [{ hi: ["a"] }];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse object with multiple fields", () => {
			const schema = z.object({
				name: z.string(),
				age: z.number(),
				active: z.boolean(),
			});
			const input = '{"name": "Alice", "age": 30, "active": true}';
			const expected = { name: "Alice", age: 30, active: true };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse object with array field", () => {
			const schema = z.object({
				name: z.string(),
				tags: z.array(z.string()),
			});
			const input = '{"name": "Alice", "tags": ["developer", "manager"]}';
			const expected = { name: "Alice", tags: ["developer", "manager"] };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Object Extraction from Text", () => {
		it("should extract object from text with prefix", () => {
			const schema = z.object({
				hi: z.array(z.string()),
			});
			const input = 'The output is: {"hi": ["a", "b"]}';
			const expected = { hi: ["a", "b"] };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract object from text with extra prefix text", () => {
			const schema = z.object({
				hi: z.array(z.string()),
			});
			const input = 'This is a test. The output is: {"hi": ["a", "b"]}';
			const expected = { hi: ["a", "b"] };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract object from text with suffix", () => {
			const schema = z.object({
				hi: z.array(z.string()),
			});
			const input = '{"hi": ["a", "b"]} is the output.';
			const expected = { hi: ["a", "b"] };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract object from markdown code block", () => {
			const schema = z.object({
				one: z.string(),
				two: z.string().optional(),
			});
			const input = `Here is how you can build the API call:
    \`\`\`json
    {
        "one": "hi",
        "two": "hello"
    }
    \`\`\`
    
    \`\`\`json
        {
            "test2": {
                "key2": "value"
            },
            "test21": [
            ]    
        }
    \`\`\``;
			const expected = { one: "hi", two: "hello" };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract object from text without code block", () => {
			const schema = z.object({
				foo: z.object({
					a: z.string(),
				}),
			});
			const input = `Here is how you can build the API call:
    {
        "foo": {
            "a": "hi"
        }
    }
    
    and this
    {
        "foo": {
            "a": "twooo"
        }
    }`;
			const expected = { foo: { a: "hi" } };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should extract object from text with prefix without code block", () => {
			const schema = z.object({
				foo: z.object({
					a: z.string(),
				}),
			});
			const input = `Here is how you can build the API call:
    {
        "foo": {
            "a": "hi"
        }
    }
    
    and this
    {
        "foo": {
            "a": "twooo"
        }
    }`;
			const expected = { foo: { a: "hi" } };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("String Fields with Quotes", () => {
		it("should handle string with escaped quotes", () => {
			const schema = z.object({
				foo: z.string(),
			});
			const input = '{"foo": "["bar"]"}';
			const expected = { foo: '["bar"]' };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle string with nested JSON", () => {
			const schema = z.object({
				foo: z.string(),
			});
			const input = '{"foo": "{"foo": ["bar"]}"}';
			const expected = { foo: '{"foo": ["bar"]}' };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle string with code block content", () => {
			const schema = z.object({
				foo: z.string(),
			});
			const input = `{  
  "foo": "Here is how you can build the API call:\\n\`\`\`json\\n{\\n  \\"foo\\": {\\n    \\"world\\": [\\n      \\"bar\\"\\n    ]\\n  }\\n}\\n\`\`\`"
}`;
			const expected = {
				foo: 'Here is how you can build the API call:\n```json\n{\n  "foo": {\n    "world": [\n      "bar"\n    ]\n  }\n}\n```',
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle string with unescaped quotes", () => {
			const schema = z.object({
				rec_one: z.string(),
				rec_two: z.string(),
				also_rec_one: z.string(),
			});
			const input =
				'{ rec_one: "and then i said \\"hi\\", and also \\"bye\\"", rec_two: "and then i said "hi", and also "bye"", "also_rec_one": ok }';
			const expected = {
				rec_one: 'and then i said "hi", and also "bye"',
				rec_two: 'and then i said "hi", and also "bye"',
				also_rec_one: "ok",
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle string field with spaces and newlines", () => {
			const schema = z.object({
				a: z.string(),
				b: z.string(),
				res: z.array(z.string()),
			});
			const input = `{
    a: Hi friends!,
    b: hey world lets do something kinda cool
    so that we can test this out,
    res: [hello,
     world]
  }`;
			const expected = {
				a: "Hi friends!",
				b: "hey world lets do something kinda cool\n    so that we can test this out",
				res: ["hello", "world"],
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle empty string values", () => {
			const schema = z.object({
				a: z.string(),
			});
			const input = '{"a": ""}';
			const expected = { a: "" };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle empty string values without quotes", () => {
			const schema = z.object({
				a: z.string(),
			});
			const input = '{a: ""}';
			const expected = { a: "" };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle multiple empty string values", () => {
			const schema = z.object({
				a: z.string(),
				b: z.string(),
				res: z.array(z.string()),
			});
			const input = `{
    a: "",
    b: "",
    res: []
  }`;
			const expected = { a: "", b: "", res: [] };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Optional and Nullable Fields", () => {
		it("should handle object with optional field missing", () => {
			const schema = z.object({
				foo: z.string().optional(),
			});
			const input = "{}";
			const expected = {};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle object with optional field present", () => {
			const schema = z.object({
				foo: z.string().optional(),
			});
			const input = '{"foo": ""}';
			const expected = { foo: "" };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle object with nullable field", () => {
			const schema = z.object({
				name: z.string(),
				email: z.string().nullable(),
			});
			const input = '{"name": "Alice", "email": null}';
			const expected = { name: "Alice", email: null };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle mix of required and optional fields", () => {
			const schema = z.object({
				one: z.string(),
				two: z.string().optional(),
			});
			const input = '{"one": "a"}';
			const expected = { one: "a" };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle optional field with value", () => {
			const schema = z.object({
				one: z.string(),
				two: z.string().optional(),
			});
			const input = '{"one": "a", "two": "b"}';
			const expected = { one: "a", two: "b" };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle multiple fields with arrays", () => {
			const schema = z.object({
				a: z.number(),
				b: z.string(),
				c: z.array(z.string()),
			});
			const input = '{"a": 1, "b": "hi", "c": ["a", "b"]}';
			const expected = { a: 1, b: "hi", c: ["a", "b"] };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Nested Objects", () => {
		it("should parse object with nested object", () => {
			const schema = z.object({
				foo: z.object({
					a: z.string(),
				}),
			});
			const input = '{"foo": {"a": "hi"}}';
			const expected = { foo: { a: "hi" } };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse nested object with markdown extraction", () => {
			const schema = z.object({
				foo: z.object({
					a: z.string(),
				}),
			});
			const input = `Here is how you can build the API call:
    \`\`\`json
    {
        "foo": {
            "a": "hi"
        }
    }
    \`\`\`
    
    and this
    \`\`\`json
    {
        "foo": {
            "a": "twooo"
        }
    }`;
			const expected = { foo: { a: "hi" } };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse nested object with prefix text", () => {
			const schema = z.object({
				foo: z.object({
					a: z.string(),
				}),
			});
			const input = `Here is how you can build the API call:
    {
        "foo": {
            "a": "hi"
        }
    }
    
    and this
    {
        "foo": {
            "a": "twooo"
        }
    }`;
			const expected = { foo: { a: "hi" } };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse nested object with array fields", () => {
			const schema = z.object({
				name: z.string(),
				education: z.array(
					z.object({
						school: z.string(),
						degree: z.string(),
						year: z.number(),
					}),
				),
				skills: z.array(z.string()),
			});
			const input = `{
        "name": "Vaibhav Gupta",
        "education": [
            {
                "school": "FOOO",
                "degree": "FOOO",
                "year": 2015
            },
            {
                "school": "BAAR",
                "degree": "BAAR",
                "year": 2019
            }
        ],
        "skills": [
          "C++",
          "SIMD on custom silicon"
        ]
      }`;
			const expected = {
				name: "Vaibhav Gupta",
				education: [
					{
						school: "FOOO",
						degree: "FOOO",
						year: 2015,
					},
					{
						school: "BAAR",
						degree: "BAAR",
						year: 2019,
					},
				],
				skills: ["C++", "SIMD on custom silicon"],
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse array of nested objects", () => {
			const schema = z.array(
				z.object({
					school: z.string(),
					degree: z.string(),
					year: z.number(),
				}),
			);
			const input = `[
          {
            "school": "FOOO",
            "degree": "FOOO",
            "year": 2015
          },
          {
            "school": "BAAR",
            "degree": "BAAR",
            "year": 2019
          }
        ]`;
			const expected = [
				{
					school: "FOOO",
					degree: "FOOO",
					year: 2015,
				},
				{
					school: "BAAR",
					degree: "BAAR",
					year: 2019,
				},
			];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});


	describe("Whitespace and Formatting", () => {
		it("should handle whitespace in keys", () => {
			const schema = z.object({
				answer: z.object({
					content: z.number(),
				}),
			});
			const input = '{" answer ": {" content ": 78.54}}';
			const expected = {
				answer: {
					content: 78.54,
				},
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle trailing comma with space", () => {
			const schema = z.object({
				function_name: z.string(),
				diameter: z.number(),
			});
			const input = `{
      // Calculate the circumference of a circle based on the diameter.
      function_name: 'circle.calculate_circumference',
      // The diameter of the circle. (with a ", ")
      diameter: 10, 
    }`;
			const expected = {
				function_name: "circle.calculate_circumference",
				diameter: 10,
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle trailing comma with extra text", () => {
			const schema = z.object({
				function_name: z.string(),
				diameter: z.number(),
			});
			const input = `{
      // Calculate the circumference of a circle based on the diameter.
      function_name: 'circle.calculate_circumference',
      // The diameter of the circle. (with a ", ")
      diameter: 10, 
      Some key: "Some value"
    }
    and this`;
			const expected = {
				function_name: "circle.calculate_circumference",
				diameter: 10,
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Union Object Creation", () => {
		it("should create union objects when not present", () => {
			const functionSchema = z.object({
				selected: z.union([
					z.object({
						function_name: z.string(),
						radius: z.number(),
					}),
					z.object({
						function_name: z.string(),
						diameter: z.number(),
					}),
					z.object({
						function_name: z.string(),
						length: z.number(),
						breadth: z.number(),
					}),
				]),
			});
			const schema = z.array(functionSchema);
			const input = `[
        {
          // Calculate the area of a circle based on the radius.
          function_name: 'circle.calculate_area',
          // The radius of the circle.
          radius: 5,
        },
        {
          // Calculate the circumference of a circle based on the diameter.
          function_name: 'circle.calculate_circumference',
          // The diameter of the circle.
          diameter: 10,
        }
      ]`;
			const expected = [
				{
					selected: {
						function_name: "circle.calculate_area",
						radius: 5,
					},
				},
				{
					selected: {
						function_name: "circle.calculate_circumference",
						diameter: 10,
					},
				},
			];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Single Value Coercion", () => {
		it("should coerce single int to object", () => {
			const schema = z.object({
				foo: z.number(),
			});
			const input = "1214";
			const expected = { foo: 1214 };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should coerce single float to object", () => {
			const schema = z.object({
				foo: z.number(),
			});
			const input = "1214.123";
			const expected = { foo: 1214.123 };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should coerce single boolean to object", () => {
			const schema = z.object({
				foo: z.boolean(),
			});
			const input = " true ";
			const expected = { foo: true };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Recursive Objects", () => {
		it("should parse simple recursive object", () => {
			type RecursiveType = {
				pointer?: RecursiveType | null;
			};

			const schema: z.ZodSchema<RecursiveType> = z.object({
				pointer: z
					.lazy(() => schema)
					.nullable()
					.optional(),
			});

			const input = `The answer is
    {
      "pointer": {
        "pointer": null
      }
    },
  
    Anything else I can help with?`;
			const expected = {
				pointer: {
					pointer: null,
				},
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse recursive object with missing brackets", () => {
			type RecursiveType = {
				pointer?: RecursiveType | null;
			};

			const schema: z.ZodSchema<RecursiveType> = z.object({
				pointer: z
					.lazy(() => schema)
					.nullable()
					.optional(),
			});

			const input = `The answer is
    {
      "pointer": {
        pointer: null,
  
    Anything else I can help with?`;
			const expected = {
				pointer: {
					pointer: null,
				},
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse recursive object with union", () => {
			type RecursiveType = {
				pointer: RecursiveType | number;
			};

			const schema: z.ZodSchema<RecursiveType> = z.object({
				pointer: z.union([z.lazy(() => schema), z.number()]),
			});

			const input = `The answer is
    {
      "pointer": {
        "pointer": 1,
      }
    },

    Anything else I can help with?`;
			const expected = {
				pointer: {
					pointer: 1,
				},
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse mutually recursive objects", () => {
			type FooType = {
				b: BarType | number;
			};

			type BarType = {
				f: FooType | number;
			};

			const fooSchema: z.ZodSchema<FooType> = z.object({
				b: z.union([z.lazy(() => barSchema), z.number()]),
			});

			const barSchema: z.ZodSchema<BarType> = z.object({
				f: z.union([z.lazy(() => fooSchema), z.number()]),
			});

			const input = `The answer is
    {
      "b": {
        "f": {
          "b": 1
        },
      }
    },

    Anything else I can help with?`;
			const expected = {
				b: {
					f: {
						b: 1,
					},
				},
			};

			const result = parser.parse(input, fooSchema);
			expect(result).toEqual(expected);
		});

		it("should parse recursive object with union and missing brackets", () => {
			type RecursiveType = {
				pointer: RecursiveType | number;
			};

			const schema: z.ZodSchema<RecursiveType> = z.object({
				pointer: z.union([z.lazy(() => schema), z.number()]),
			});

			const input = `The answer is
    {
      "pointer": {
        pointer: 1
    },

    Anything else I can help with?`;
			const expected = {
				pointer: {
					pointer: 1,
				},
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse recursive object with multiple fields", () => {
			type RecursiveType = {
				rec_one: RecursiveType | number | boolean;
				rec_two: RecursiveType | number | boolean | null;
			};

			const schema: z.ZodSchema<RecursiveType> = z.object({
				rec_one: z.union([z.lazy(() => schema), z.number(), z.boolean()]),
				rec_two: z.union([
					z.lazy(() => schema),
					z.number(),
					z.boolean(),
					z.null(),
				]),
			});

			const input = `The answer is
    {
      "rec_one": { "rec_one": 1, "rec_two": 2 },
      "rec_two": {
        "rec_one": { "rec_one": 1, "rec_two": 2 },
        "rec_two": { "rec_one": 1, "rec_two": 2 }
      }
    },

    Anything else I can help with?`;
			const expected = {
				rec_one: {
					rec_one: 1,
					rec_two: 2,
				},
				rec_two: {
					rec_one: {
						rec_one: 1,
						rec_two: 2,
					},
					rec_two: {
						rec_one: 1,
						rec_two: 2,
					},
				},
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse recursive object with multiple fields without quotes", () => {
			type RecursiveType = {
				rec_one: RecursiveType | number | boolean;
				rec_two: RecursiveType | number | boolean | null;
			};

			const schema: z.ZodSchema<RecursiveType> = z.object({
				rec_one: z.union([z.lazy(() => schema), z.number(), z.boolean()]),
				rec_two: z.union([
					z.lazy(() => schema),
					z.number(),
					z.boolean(),
					z.null(),
				]),
			});

			const input = `The answer is
    {
      rec_one: { rec_one: 1, rec_two: 2 },
      rec_two: {
        rec_one: { rec_one: 1, rec_two: 2 },
        rec_two: { rec_one: 1, rec_two: 2 }
      }
    },

    Anything else I can help with?`;
			const expected = {
				rec_one: {
					rec_one: 1,
					rec_two: 2,
				},
				rec_two: {
					rec_one: {
						rec_one: 1,
						rec_two: 2,
					},
					rec_two: {
						rec_one: 1,
						rec_two: 2,
					},
				},
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse simple recursive single line", () => {
			type RecursiveType = {
				rec_one: RecursiveType | number | boolean;
				rec_two: RecursiveType | number | boolean | null;
			};

			const schema: z.ZodSchema<RecursiveType> = z.object({
				rec_one: z.union([z.lazy(() => schema), z.number(), z.boolean()]),
				rec_two: z.union([
					z.lazy(() => schema),
					z.number(),
					z.boolean(),
					z.null(),
				]),
			});

			const input = `The answer is
    { rec_one: true, rec_two: false },

    Anything else I can help with?`;
			const expected = {
				rec_one: true,
				rec_two: false,
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse complex recursive structure", () => {
			type RecursiveType = {
				rec_one: RecursiveType | number | boolean;
				rec_two: RecursiveType | number | boolean | null;
			};

			const schema: z.ZodSchema<RecursiveType> = z.object({
				rec_one: z.union([z.lazy(() => schema), z.number(), z.boolean()]),
				rec_two: z.union([
					z.lazy(() => schema),
					z.number(),
					z.boolean(),
					z.null(),
				]),
			});

			const input = `The answer is
    {
      rec_one: { rec_one: { rec_one: true, rec_two: false }, rec_two: null },
      rec_two: {
        rec_one: { rec_one: { rec_one: 1, rec_two: 2 }, rec_two: null },
        rec_two: { rec_one: 1, rec_two: null }
      }
    },

    Anything else I can help with?`;
			const expected = {
				rec_one: {
					rec_one: {
						rec_one: true,
						rec_two: false,
					},
					rec_two: null,
				},
				rec_two: {
					rec_one: {
						rec_one: {
							rec_one: 1,
							rec_two: 2,
						},
						rec_two: null,
					},
					rec_two: {
						rec_one: 1,
						rec_two: null,
					},
				},
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Complex Real-world Examples", () => {
		it("should parse resume with complex nested structure", () => {
			const schema = z.object({
				name: z.string(),
				email: z.string().nullable(),
				phone: z.string().nullable(),
				experience: z.array(z.string()),
				education: z.array(z.string()),
				skills: z.array(z.string()),
			});

			const input = `{
        "name": "Lee Hsien Loong",
        "email": null,
        "phone": null,
        "experience": [
            "Senior Minister of Singapore since 2024",
            "Prime Minister of Singapore from 2004 to 2024",
            "Member of Parliament (MP) for the Teck Ghee division of Ang Mo Kio GRC since 1991",
            "Teck Ghee SMC between 1984 and 1991",
            "Secretary-General of the People's Action Party (PAP) since 2004"
        ],
        "education": [],
        "skills": ["politician", "former brigadier-general"]
    }`;

			const expected = {
				name: "Lee Hsien Loong",
				email: null,
				phone: null,
				experience: [
					"Senior Minister of Singapore since 2024",
					"Prime Minister of Singapore from 2004 to 2024",
					"Member of Parliament (MP) for the Teck Ghee division of Ang Mo Kio GRC since 1991",
					"Teck Ghee SMC between 1984 and 1991",
					"Secretary-General of the People's Action Party (PAP) since 2004",
				],
				education: [],
				skills: ["politician", "former brigadier-general"],
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should parse complex AI-generated content with code sections", () => {
			const schema = z.object({
				sections: z.array(
					z.union([
						z.object({
							text: z.string(),
						}),
						z.object({
							code_language: z.string(),
							code: z.string(),
						}),
					]),
				),
			});

			const input = `{
  "sections": [
    {
      "code_language": "swift",
      "code": "import SwiftUI\\n\\nstruct ContentView: View {\\n    var body: some View {\\n        Text(\\"Hello, World!\\")\\n    }\\n}\\n\\n#Preview {\\n    ContentView()\\n}\\n"
    },
    {
      "text": "This is a simple SwiftUI app that displays 'Hello, World!' text."
    }
  ]
}`;

			const expected = {
				sections: [
					{
						code_language: "swift",
						code: 'import SwiftUI\n\nstruct ContentView: View {\n    var body: some View {\n        Text("Hello, World!")\n    }\n}\n\n#Preview {\n    ContentView()\n}\n',
					},
					{
						text: "This is a simple SwiftUI app that displays 'Hello, World!' text.",
					},
				],
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Streaming/Partial Parsing", () => {
		it("should handle object with finished integers", () => {
			const schema = z.object({
				a: z.number(),
				c: z.number(),
				b: z.number(),
			});
			const input = '{"a": 1234,"b": 1234, "c": 1234}';
			const expected = { a: 1234, b: 1234, c: 1234 };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle partial resume parsing", () => {
			const schema = z.object({
				name: z.string(),
				email: z.string().nullable(),
				phone: z.string().nullable(),
				experience: z.array(z.string()),
				education: z.array(z.string()),
				skills: z.array(z.string()),
			});

			const input = `{
        "name": "Lee Hsien Loong",
        "email": null,
        "phone": null,
        "experience": [
            "Senior Minister of Singapore since 2024",
            "Prime Minister of Singapore from 2004 to `;

			const expected = {
				name: "Lee Hsien Loong",
				email: null,
				phone: null,
				experience: [
					"Senior Minister of Singapore since 2024",
					"Prime Minister of Singapore from 2004 to ",
				],
				education: [],
				skills: [],
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});
});
