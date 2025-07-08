import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createParser } from "../src/parser";

const parser = createParser();

describe("Aliases", () => {
	describe("Recursive Type Aliases", () => {
		// Simple recursive list type: type A = A[]
		type RecursiveList = RecursiveList[];
		const createRecursiveListType = (): z.ZodType<RecursiveList> => {
			const schema: z.ZodType<RecursiveList> = z.lazy(() => z.array(schema));
			return schema;
		};

		test("should parse simple recursive alias list", () => {
			const schema = createRecursiveListType();
			const input = "[[], [], [[]]]";
			const expected = [[], [], [[]]];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		// Simple recursive map type: type A = map<string, A>
		interface RecursiveMap {
			[key: string]: RecursiveMap;
		}
		const createRecursiveMapType = (): z.ZodType<RecursiveMap> => {
			const schema: z.ZodType<RecursiveMap> = z.lazy(() =>
				z.record(z.string(), schema),
			);
			return schema;
		};

		test("should parse simple recursive alias map", () => {
			const schema = createRecursiveMapType();
			const input = '{"one": {"two": {}}, "three": {"four": {}}}';
			const expected = {
				one: { two: {} },
				three: { four: {} },
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		test("should parse recursive map in union", () => {
			const recursiveMap = createRecursiveMapType();
			const schema = z.union([recursiveMap, z.number()]);
			const input = '{"one": {"two": {}}, "three": {"four": {}}}';
			const expected = {
				one: { two: {} },
				three: { four: {} },
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		// Recursive alias cycle: A = B, B = C, C = A[]
		test("should parse recursive alias cycle", () => {
			// In TypeScript/Zod, we can't directly represent mutual recursion like BAML
			// So we simulate with a recursive array type
			const schema = createRecursiveListType();
			const input = "[[], [], [[]]]";
			const expected = [[], [], [[]]];

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("JsonValue Type", () => {
		// JsonValue = int | float | bool | string | null | JsonValue[] | map<string, JsonValue>
		type JsonValue =
			| number
			| boolean
			| string
			| null
			| JsonValue[]
			| { [key: string]: JsonValue };

		const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
			z.union([
				z.number(),
				z.boolean(),
				z.string(),
				z.null(),
				z.array(JsonValueSchema),
				z.record(z.string(), JsonValueSchema),
			]),
		);

		test("should parse JSON without nested objects", () => {
			const input = `{
        "int": 1,
        "float": 1.0,
        "string": "test",
        "bool": true
      }`;
			const expected = {
				int: 1,
				float: 1.0,
				string: "test",
				bool: true,
			};

			const result = parser.parse(input, JsonValueSchema);
			expect(result).toEqual(expected);
		});

		test("should parse JSON with nested list", () => {
			const input = `{
        "number": 1,
        "string": "test",
        "bool": true,
        "list": [1, 2, 3]
      }`;
			const expected = {
				number: 1,
				string: "test",
				bool: true,
				list: [1, 2, 3],
			};

			const result = parser.parse(input, JsonValueSchema);
			expect(result).toEqual(expected);
		});

		test("should parse JSON with nested object", () => {
			const input = `{
        "number": 1,
        "string": "test",
        "bool": true,
        "json": {
          "number": 1,
          "string": "test",
          "bool": true
        }
      }`;
			const expected = {
				number: 1,
				string: "test",
				bool: true,
				json: {
					number: 1,
					string: "test",
					bool: true,
				},
			};

			const result = parser.parse(input, JsonValueSchema);
			expect(result).toEqual(expected);
		});

		test("should parse full JSON with deeply nested objects", () => {
			const input = `{
        "number": 1,
        "string": "test",
        "bool": true,
        "list": [1, 2, 3],
        "object": {
          "number": 1,
          "string": "test",
          "bool": true,
          "list": [1, 2, 3]
        },
        "json": {
          "number": 1,
          "string": "test",
          "bool": true,
          "list": [1, 2, 3],
          "object": {
            "number": 1,
            "string": "test",
            "bool": true,
            "list": [1, 2, 3]
          }
        }
      }`;
			const expected = {
				number: 1,
				string: "test",
				bool: true,
				list: [1, 2, 3],
				object: {
					number: 1,
					string: "test",
					bool: true,
					list: [1, 2, 3],
				},
				json: {
					number: 1,
					string: "test",
					bool: true,
					list: [1, 2, 3],
					object: {
						number: 1,
						string: "test",
						bool: true,
						list: [1, 2, 3],
					},
				},
			};

			const result = parser.parse(input, JsonValueSchema);
			expect(result).toEqual(expected);
		});

		test("should parse list of JSON objects", () => {
			const input = `[
        {
          "number": 1,
          "string": "test",
          "bool": true,
          "list": [1, 2, 3]
        },
        {
          "number": 1,
          "string": "test",
          "bool": true,
          "list": [1, 2, 3]
        }
      ]`;
			const expected = [
				{
					number: 1,
					string: "test",
					bool: true,
					list: [1, 2, 3],
				},
				{
					number: 1,
					string: "test",
					bool: true,
					list: [1, 2, 3],
				},
			];

			const result = parser.parse(input, JsonValueSchema);
			expect(result).toEqual(expected);
		});

		test("should parse nested list", () => {
			const input = "[[42.1]]";
			const expected = [[42.1]];

			const result = parser.parse(input, JsonValueSchema);
			expect(result).toEqual(expected);
		});

		test("should parse JSON defined with cycles (using mutually recursive types)", () => {
			// In TypeScript we simulate: JsonValue = int | float | bool | string | null | JsonArray | JsonObject
			// JsonArray = JsonValue[], JsonObject = map<string, JsonValue>
			const input = `{
        "number": 1,
        "string": "test",
        "bool": true,
        "json": {
          "number": 1,
          "string": "test",
          "bool": true
        }
      }`;
			const expected = {
				number: 1,
				string: "test",
				bool: true,
				json: {
					number: 1,
					string: "test",
					bool: true,
				},
			};

			const result = parser.parse(input, JsonValueSchema);
			expect(result).toEqual(expected);
		});

		test("should parse recipe JSON with mixed types", () => {
			const input = `{
        "recipe": {
          "name": "Chocolate Chip Cookies",
          "servings": 24,
          "ingredients": [
            "2 1/4 cups all-purpose flour", "1/2 teaspoon baking soda",
            "1 cup unsalted butter, room temperature",
            "1/2 cup granulated sugar",
            "1 cup packed light-brown sugar",
            "1 teaspoon salt", "2 teaspoons pure vanilla extract",
            "2 large eggs", "2 cups semisweet and/or milk chocolate chips"
          ],
          "instructions": [
            "Preheat oven to 350°F (180°C).",
            "In a small bowl, whisk together flour and baking soda; set aside.",
            "In a large bowl, cream butter and sugars until light and fluffy.",
            "Add salt, vanilla, and eggs; mix well.",
            "Gradually stir in flour mixture.",
            "Fold in chocolate chips.",
            "Drop by rounded tablespoons onto ungreased baking sheets.",
            "Bake for 10-12 minutes or until golden brown.",
            "Cool on wire racks."
          ]
        }
      }`;
			const expected = {
				recipe: {
					name: "Chocolate Chip Cookies",
					servings: 24,
					ingredients: [
						"2 1/4 cups all-purpose flour",
						"1/2 teaspoon baking soda",
						"1 cup unsalted butter, room temperature",
						"1/2 cup granulated sugar",
						"1 cup packed light-brown sugar",
						"1 teaspoon salt",
						"2 teaspoons pure vanilla extract",
						"2 large eggs",
						"2 cups semisweet and/or milk chocolate chips",
					],
					instructions: [
						"Preheat oven to 350°F (180°C).",
						"In a small bowl, whisk together flour and baking soda; set aside.",
						"In a large bowl, cream butter and sugars until light and fluffy.",
						"Add salt, vanilla, and eggs; mix well.",
						"Gradually stir in flour mixture.",
						"Fold in chocolate chips.",
						"Drop by rounded tablespoons onto ungreased baking sheets.",
						"Bake for 10-12 minutes or until golden brown.",
						"Cool on wire racks.",
					],
				},
			};

			const result = parser.parse(input, JsonValueSchema);
			expect(result).toEqual(expected);
		});
	});
});
