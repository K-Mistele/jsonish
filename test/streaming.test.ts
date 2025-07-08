import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createParser } from "../src/parser";

const parser = createParser();

describe("Streaming", () => {
	describe("Basic Streaming", () => {
		it("should parse incomplete array during streaming", () => {
			const schema = z.object({
				nums: z.array(z.number()),
			});
			const input = "{'nums': [1,2";
			const expected = { nums: [1] };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle streaming with state tracking", () => {
			const StreamWithStateSchema = z.object({
				nums: z.object({
					value: z.array(z.number()),
					state: z.enum(["Incomplete", "Complete", "Pending"]),
				}),
				bar: z.object({
					value: z.number().nullable(),
					state: z.enum(["Incomplete", "Complete", "Pending"]),
				}),
			});
			const input = "{'nums': [1,2";
			const expected = {
				nums: { value: [1], state: "Incomplete" as const },
				bar: { value: null, state: "Pending" as const },
			};

			const result = parser.parse(input, StreamWithStateSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Stream Done Behavior", () => {
		it("should fail on incomplete object with top-level @stream.done", () => {
			const schema = z.object({
				nums: z.array(z.number()),
			});
			const input = "{'nums': [1,2]";

			// This should fail because @stream.done requires complete objects
			expect(() => parser.parse(input, schema)).toThrow();
		});

		it("should handle nested @stream.done with partial data", () => {
			const FooSchema = z.object({
				nums: z.array(z.number()),
			});
			const BarSchema = z.object({
				foos: z.array(FooSchema),
			});
			const input = `{
    'foos': [
      {'nums': [1, 2]},
      {'nums': [3, 4]
  `;
			const expected = {
				foos: [{ nums: [1, 2] }],
			};

			const result = parser.parse(input, BarSchema);
			expect(result).toEqual(expected);
		});

		it("should handle nested @stream.done with top-level @stream.done", () => {
			const FooSchema = z.object({
				nums: z.array(z.number()),
			});
			const BarSchema = z.object({
				message: z.string(),
				foos: z.array(FooSchema),
			});
			const input = `{
    'message': "Hello",
    'foos': [
      {'nums': [1, 2]},
      {'nums': [3, 4]
  `;
			const expected = {
				message: "Hello",
				foos: [{ nums: [1, 2] }],
			};

			const result = parser.parse(input, BarSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Stream Not Null Behavior", () => {
		it("should handle @stream.not_null with incomplete data", () => {
			const FooSchema = z.object({
				my_int: z.number(),
				my_string: z.string(),
			});
			const BarSchema = z.object({
				foos: z.array(FooSchema),
			});
			const input = `{"foos": [{"my_int": 1, "my"`;
			const expected = { foos: [] };

			const result = parser.parse(input, BarSchema);
			expect(result).toEqual(expected);
		});

		it("should handle @stream.done field with incomplete string (empty)", () => {
			const schema = z.object({
				foo: z.string().nullable(),
				bar: z.string().nullable(),
			});
			const input = `{"foo": "`;
			const expected = { foo: null, bar: null };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle @stream.done field with incomplete string (with content)", () => {
			const schema = z.object({
				foo: z.string().nullable(),
				bar: z.string().nullable(),
			});
			const input = `{"foo": ""`;
			const expected = { foo: "", bar: null };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Large Memory Test", () => {
		it("should handle large streaming test with complex unions", () => {
			const MemoryObjectSchema = z.object({
				id: z.string(),
				name: z.string(),
				description: z.string(),
			});

			const ComplexMemoryObjectSchema = z.object({
				id: z.string(),
				name: z.string(),
				description: z.string(),
				metadata: z.array(z.union([z.string(), z.number()])).optional(),
			});

			const AnotherObjectSchema = z.object({
				id: z.string(),
				thingy2: z.string(),
				thingy3: z.string(),
			});

			const TestMemoryOutputSchema = z.object({
				items: z.array(
					z.union([
						MemoryObjectSchema,
						ComplexMemoryObjectSchema,
						AnotherObjectSchema,
					]),
				),
				more_items: z.array(
					z.union([
						MemoryObjectSchema,
						ComplexMemoryObjectSchema,
						AnotherObjectSchema,
					]),
				),
			});

			const input = `{
  "items": [
    {
      "id": "1",
      "name": "MemoryObject1",
      "description": "A simple memory object."
    },
    {
      "id": "2",
      "name": "MemoryObject2",
      "description": "A more complex memory object with metadata.",
      "metadata": [
        "metadata1",
        42,
        3.12
      ]
    },
    {
      "id": "3",
      "thingy2": "Thingy2Value",
      "thingy3": "Thingy3Value"
    },
    {
      "id": "4",
      "name": "MemoryObject4",
      "description": "Another simple memory object."
    },
    {
      "id": "5",
      "name": "MemoryObject5",
      "description": "Complex object with metadata.",
      "metadata": [
        "additional info",
        100,
        2.715
      ]
    },
    {
      "id": "6",
      "thingy2": "AnotherThingy2",
      "thingy3": "AnotherThingy3"
    },
    {
      "id": "7",
      "name": "MemoryObject7",
      "description": "Simple object with no metadata."
    },
    {
      "id": "8",
      "name": "MemoryObject8",
      "description": "Complex object with varied metadata.",
      "metadata": [
        "info",
        256,
        1.618
      ]
    },
    {
      "id": "9",
      "thingy2": "Thingy2Example",
      "thingy3": "Thingy3Example"
    },
    {
      "id": "10",
      "name": "MemoryObject10",
      "description": "Final simple memory object."
    }
  ],
  "more_items": [
    {
      "id": "11",
      "name": "MemoryObject11",
      "description": "Additional simple memory object."
    },
    {
      "id": "12",
      "name": "MemoryObject12",
      "description": "Additional complex object with metadata.",
      "metadata": [
        "extra data",
        512,
        0.577
      ]
    },
    {
      "id": "13",
      "thingy2": "ExtraThingy2",
      "thingy3": "ExtraThingy3"
    }
  ]
}`;

			const expected = {
				items: [
					{
						id: "1",
						name: "MemoryObject1",
						description: "A simple memory object.",
					},
					{
						id: "2",
						name: "MemoryObject2",
						description: "A more complex memory object with metadata.",
						metadata: ["metadata1", 42, 3.12],
					},
					{
						id: "3",
						thingy2: "Thingy2Value",
						thingy3: "Thingy3Value",
					},
					{
						id: "4",
						name: "MemoryObject4",
						description: "Another simple memory object.",
					},
					{
						id: "5",
						name: "MemoryObject5",
						description: "Complex object with metadata.",
						metadata: ["additional info", 100, 2.715],
					},
					{
						id: "6",
						thingy2: "AnotherThingy2",
						thingy3: "AnotherThingy3",
					},
					{
						id: "7",
						name: "MemoryObject7",
						description: "Simple object with no metadata.",
					},
					{
						id: "8",
						name: "MemoryObject8",
						description: "Complex object with varied metadata.",
						metadata: ["info", 256, 1.618],
					},
					{
						id: "9",
						thingy2: "Thingy2Example",
						thingy3: "Thingy3Example",
					},
					{
						id: "10",
						name: "MemoryObject10",
						description: "Final simple memory object.",
					},
				],
				more_items: [
					{
						id: "11",
						name: "MemoryObject11",
						description: "Additional simple memory object.",
					},
					{
						id: "12",
						name: "MemoryObject12",
						description: "Additional complex object with metadata.",
						metadata: ["extra data", 512, 0.577],
					},
					{
						id: "13",
						thingy2: "ExtraThingy2",
						thingy3: "ExtraThingy3",
					},
				],
			};

			const result = parser.parse(input, TestMemoryOutputSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Tool-based Union Streaming", () => {
		it("should handle union streaming with MessageToUser", () => {
			const MessageToUserSchema = z.object({
				type: z.literal("message_to_user"),
				message: z.string(),
			});

			const AdjustItemSchema = z.object({
				type: z.literal("adjust_item"),
				item_id: z.number(),
				title: z.string().optional(),
			});

			const AddItemSchema = z.object({
				type: z.literal("add_item"),
				title: z.string(),
			});

			const GetLastItemIdSchema = z.object({
				type: z.literal("get_last_item_id"),
			});

			const ToolSchema = z.union([
				MessageToUserSchema,
				AdjustItemSchema,
				AddItemSchema,
				GetLastItemIdSchema,
			]);

			const input = `{"type": "message_to_user", "message": "Hello us"`;
			const expected = {
				type: "message_to_user" as const,
				message: "Hello us",
			};

			const result = parser.parse(input, ToolSchema);
			expect(result).toEqual(expected);
		});

		it("should fail on union with @stream.done when incomplete", () => {
			const MessageToUserSchema = z.object({
				type: z.literal("message_to_user"),
				message: z.string(),
			});

			const AdjustItemSchema = z.object({
				type: z.literal("adjust_item"),
				item_id: z.number(),
				title: z.string().optional(),
			});

			const AddItemSchema = z.object({
				type: z.literal("add_item"),
				title: z.string(),
			});

			const GetLastItemIdSchema = z.object({
				type: z.literal("get_last_item_id"),
			});

			const ToolSchema = z.union([
				MessageToUserSchema,
				AdjustItemSchema,
				AddItemSchema,
				GetLastItemIdSchema,
			]);

			const input = `{"type": "adjust_item", "item_id": 1, "title": "New Title"`;

			// This should fail because AdjustItem has @stream.done and the object is incomplete
			expect(() => parser.parse(input, ToolSchema)).toThrow();
		});
	});

	describe("Semantic Container Streaming", () => {
		it("should fail with @stream.not_null fields receiving null values", () => {
			const ClassWithBlockDoneSchema = z.object({
				i_16_digits: z.number(),
				s_20_words: z.string(),
			});

			const ClassWithoutDoneSchema = z.object({
				i_16_digits: z.number(),
				s_20_words: z.object({
					value: z.string(),
					state: z.enum(["Incomplete", "Complete", "Pending"]),
				}),
			});

			const SmallThingSchema = z.object({
				i_16_digits: z.number(),
				i_8_digits: z.number(),
			});

			const SemanticContainerSchema = z.object({
				sixteen_digit_number: z.number(),
				string_with_twenty_words: z.string(),
				class_1: ClassWithoutDoneSchema.nullable(),
				class_2: ClassWithBlockDoneSchema.nullable(),
				class_done_needed: ClassWithBlockDoneSchema.nullable(),
				class_needed: ClassWithoutDoneSchema.nullable(),
				three_small_things: z.array(SmallThingSchema),
				final_string: z.string(),
			});

			const input = `{
        "sixteen_digit_number": 1234567890123456,
        "string_with_twenty_words": "This is a string with exactly twenty words in it for testing purposes and validation",
        "class_1": null,
        "class_2": null,
        "class_done_needed": null,
        "class_needed": null,
        "three_small_things": [],
        "final_string": "end"
    }`;

			// This should fail because @stream.not_null fields are null
			expect(() => parser.parse(input, SemanticContainerSchema)).toThrow();
		});

		it("should succeed with @stream.not_null fields having values", () => {
			const ClassWithBlockDoneSchema = z.object({
				i_16_digits: z.number(),
				s_20_words: z.string(),
			});

			const ClassWithoutDoneSchema = z.object({
				i_16_digits: z.number(),
				s_20_words: z.object({
					value: z.string(),
					state: z.enum(["Incomplete", "Complete", "Pending"]),
				}),
			});

			const SmallThingSchema = z.object({
				i_16_digits: z.number(),
				i_8_digits: z.number(),
			});

			const SemanticContainerSchema = z.object({
				sixteen_digit_number: z.number(),
				string_with_twenty_words: z.string(),
				class_1: ClassWithoutDoneSchema,
				class_2: ClassWithBlockDoneSchema,
				class_done_needed: ClassWithBlockDoneSchema,
				class_needed: ClassWithoutDoneSchema,
				three_small_things: z.array(SmallThingSchema),
				final_string: z.string(),
			});

			const input = `{
        "sixteen_digit_number": 12345678,
        "string_with_twenty_words": "This is a string with exactly twenty words in it for testing purposes and validation",
        "class_1": {
            "i_16_digits": 12345678,
            "s_20_words": "Another string with twenty words"
        },
        "class_2": {
            "i_16_digits": 98765432,
            "s_20_words": "Yet another string here"
        },
        "class_done_needed": {
            "i_16_digits": 11111111,
            "s_20_words": "Required class string"
        },
        "class_needed": {
            "i_16_digits": 22222222,
            "s_20_words": "Another required string"
        },
        "three_small_things": [
            {"i_16_digits": 33333333, "i_8_digits": 12345678}
        ],
        "final_string": "end"
    }`;

			const expected = {
				sixteen_digit_number: 12345678,
				string_with_twenty_words:
					"This is a string with exactly twenty words in it for testing purposes and validation",
				class_1: {
					i_16_digits: 12345678,
					s_20_words: {
						value: "Another string with twenty words",
						state: "Complete" as const,
					},
				},
				class_2: {
					i_16_digits: 98765432,
					s_20_words: "Yet another string here",
				},
				class_done_needed: {
					i_16_digits: 11111111,
					s_20_words: "Required class string",
				},
				class_needed: {
					i_16_digits: 22222222,
					s_20_words: {
						value: "Another required string",
						state: "Complete" as const,
					},
				},
				three_small_things: [{ i_16_digits: 33333333, i_8_digits: 12345678 }],
				final_string: "end",
			};

			const result = parser.parse(input, SemanticContainerSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Union Not Null Streaming", () => {
		it("should handle union with null value and @stream.not_null", () => {
			const schema = z.object({
				y: z.string().nullable(),
			});
			const input = `{"y": null}`;
			const expected = { y: null };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle union with string value and @stream.not_null", () => {
			const schema = z.object({
				y: z.string().nullable(),
			});
			const input = `{"y": "hello"}`;
			const expected = { y: "hello" };

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});
	});

	describe("Progressive Streaming States", () => {
		it("should handle progressive streaming with state management", () => {
			const StreamingStateSchema = z.object({
				field1: z.object({
					value: z.string().nullable(),
					state: z.enum(["Pending", "Incomplete", "Complete"]),
				}),
				field2: z.object({
					value: z.array(z.number()),
					state: z.enum(["Pending", "Incomplete", "Complete"]),
				}),
			});

			const input = `{"field1": {"value": "hello", "state": "Complete"}, "field2": {"value": [1, 2], "state": "Incomplete"}}`;
			const expected = {
				field1: { value: "hello", state: "Complete" as const },
				field2: { value: [1, 2], state: "Incomplete" as const },
			};

			const result = parser.parse(input, StreamingStateSchema);
			expect(result).toEqual(expected);
		});

		it("should handle streaming with pending state", () => {
			const StreamingStateSchema = z.object({
				pending_field: z.object({
					value: z.string().nullable(),
					state: z.literal("Pending"),
				}),
				complete_field: z.object({
					value: z.string(),
					state: z.literal("Complete"),
				}),
			});

			const input = `{"pending_field": {"value": null, "state": "Pending"}, "complete_field": {"value": "done", "state": "Complete"}}`;
			const expected = {
				pending_field: { value: null, state: "Pending" as const },
				complete_field: { value: "done", state: "Complete" as const },
			};

			const result = parser.parse(input, StreamingStateSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Streaming Array Handling", () => {
		it("should handle streaming arrays with partial elements", () => {
			const ItemSchema = z.object({
				id: z.number(),
				name: z.string(),
			});

			const StreamingArraySchema = z.object({
				items: z.array(ItemSchema),
			});

			const input = `{"items": [{"id": 1, "name": "first"}, {"id": 2, "name": "sec"`;
			const expected = {
				items: [{ id: 1, name: "first" }],
			};

			const result = parser.parse(input, StreamingArraySchema);
			expect(result).toEqual(expected);
		});

		it("should handle streaming nested arrays", () => {
			const NestedArraySchema = z.object({
				matrix: z.array(z.array(z.number())),
			});

			const input = `{"matrix": [[1, 2], [3, 4], [5, 6`;
			const expected = {
				matrix: [
					[1, 2],
					[3, 4],
				],
			};

			const result = parser.parse(input, NestedArraySchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Streaming Error Handling", () => {
		it("should handle malformed streaming JSON gracefully", () => {
			const schema = z.object({
				valid_field: z.string(),
				incomplete_field: z.string(),
			});

			const input = `{"valid_field": "hello", "incomplete_field": "wor`;
			const expected = {
				valid_field: "hello",
				incomplete_field: "wor",
			};

			const result = parser.parse(input, schema);
			expect(result).toEqual(expected);
		});

		it("should handle deeply nested streaming objects", () => {
			const DeeplyNestedSchema = z.object({
				level1: z.object({
					level2: z.object({
						level3: z.object({
							value: z.string(),
						}),
					}),
				}),
			});

			const input = `{"level1": {"level2": {"level3": {"value": "deep"`;
			const expected = {
				level1: {
					level2: {
						level3: {
							value: "deep",
						},
					},
				},
			};

			const result = parser.parse(input, DeeplyNestedSchema);
			expect(result).toEqual(expected);
		});
	});
});
