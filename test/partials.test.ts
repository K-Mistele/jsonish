import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createParser } from "../jsonish/src/index";

const parser = createParser();

describe("Partials", () => {
	// ================================================================
	// CORE RUST TESTS: These 5 tests directly correspond to the Rust implementation
	// ================================================================

	describe("Core Rust Tests", () => {
		// Book analysis schemas
		const ScoreSchema = z.object({
			year: z.number(),
			score: z.number(),
		});

		const PopularityOverTimeSchema = z.object({
			bookName: z.string(),
			scores: z.array(ScoreSchema),
		});

		const WordCountSchema = z.object({
			bookName: z.string(),
			count: z.number(),
		});

		const RankingSchema = z.object({
			bookName: z.string(),
			score: z.number(),
		});

		const BookAnalysisSchema = z.object({
			bookNames: z.array(z.string()),
			popularityOverTime: z.array(PopularityOverTimeSchema),
			popularityRankings: z.array(RankingSchema),
			wordCounts: z.array(WordCountSchema),
		});

		// Graph schemas
		const VertexSchema = z.object({
			id: z.string(),
			metadata: z.record(z.string(), z.string()),
		});

		const PartialVertexSchema = z.object({
			id: z.string().nullable(),
			metadata: z.record(z.string(), z.string()),
		});

		const EdgeSchema = z.object({
			source_id: z.string(),
			target_id: z.string(),
			relationship: z.string(),
		});

		const GraphJsonSchema = z.object({
			vertices: z.array(VertexSchema),
			edges: z.array(EdgeSchema),
		});

		const PartialGraphJsonSchema = z.object({
			vertices: z.array(PartialVertexSchema),
			edges: z.array(EdgeSchema),
		});

		const ErrorSchema = z.object({
			code: z.number(),
			message: z.string(),
		});

		const ErrorBasicSchema = z.object({
			message: z.string(),
		});

		// Rust test: test_partial_analysis_1
		test("should parse complete book analysis", () => {
			const input = `\`\`\`json
      {
        "bookNames": [
          "brave new world",
          "the lord of the rings",
          "three body problem",
          "stormlight archive"
        ],
        "popularityData": [
          {
            "bookName": "brave new world",
            "scores": [
              {"year": 1950, "score": 70},
              {"year": 1960, "score": 75},
              {"year": 1970, "score": 80},
              {"year": 1980, "score": 85},
              {"year": 1990, "score": 85},
              {"year": 2000, "score": 90},
              {"year": 2010, "score": 95},
              {"year": 2020, "score": 97},
              {"year": 2023, "score": 98}
            ]
          },
          {
            "bookName": "the lord of the rings",
            "scores": [
              {"year": 1954, "score": 60},
              {"year": 1960, "score": 75},
              {"year": 1970, "score": 85},
              {"year": 1980, "score": 90},
              {"year": 1990, "score": 92},
              {"year": 2000, "score": 95},
              {"year": 2010, "score": 96},
              {"year": 2020, "score": 98},
              {"year": 2023, "score": 99}
            ]
          },
          {
            "bookName": "three body problem",
            "scores": [
              {"year": 2008, "score": 50},
              {"year": 2010, "score": 60},
              {"year": 2015, "score": 70},
              {"year": 2020, "score": 80},
              {"year": 2023, "score": 85}
            ]
          },
          {
            "bookName": "stormlight archive",
            "scores": [
              {"year": 2010, "score": 55},
              {"year": 2014, "score": 65},
              {"year": 2017, "score": 75},
              {"year": 2020, "score": 80},
              {"year": 2023, "score": 85}
            ]
          }
        ],
        "popularityRankings": [
          {"bookName": "the lord of the rings", "score": 99},
          {"bookName": "brave new world", "score": 97},
          {"bookName": "stormlight archive", "score": 85},
          {"bookName": "three body problem", "score": 85}
        ],
        "wordCounts": [
          {"bookName": "brave new world", "count": 64000},
          {"bookName": "the lord of the rings", "count": 470000},
          {"bookName": "three body problem", "count": 150000},
          {"bookName": "stormlight archive", "count": 400000}
        ]
      }
      \`\`\``;

			const expected = {
				bookNames: [
					"brave new world",
					"the lord of the rings",
					"three body problem",
					"stormlight archive",
				],
				popularityOverTime: [
					{
						bookName: "brave new world",
						scores: [
							{ year: 1950, score: 70 },
							{ year: 1960, score: 75 },
							{ year: 1970, score: 80 },
							{ year: 1980, score: 85 },
							{ year: 1990, score: 85 },
							{ year: 2000, score: 90 },
							{ year: 2010, score: 95 },
							{ year: 2020, score: 97 },
							{ year: 2023, score: 98 },
						],
					},
					{
						bookName: "the lord of the rings",
						scores: [
							{ year: 1954, score: 60 },
							{ year: 1960, score: 75 },
							{ year: 1970, score: 85 },
							{ year: 1980, score: 90 },
							{ year: 1990, score: 92 },
							{ year: 2000, score: 95 },
							{ year: 2010, score: 96 },
							{ year: 2020, score: 98 },
							{ year: 2023, score: 99 },
						],
					},
					{
						bookName: "three body problem",
						scores: [
							{ year: 2008, score: 50 },
							{ year: 2010, score: 60 },
							{ year: 2015, score: 70 },
							{ year: 2020, score: 80 },
							{ year: 2023, score: 85 },
						],
					},
					{
						bookName: "stormlight archive",
						scores: [
							{ year: 2010, score: 55 },
							{ year: 2014, score: 65 },
							{ year: 2017, score: 75 },
							{ year: 2020, score: 80 },
							{ year: 2023, score: 85 },
						],
					},
				],
				popularityRankings: [
					{ bookName: "the lord of the rings", score: 99 },
					{ bookName: "brave new world", score: 97 },
					{ bookName: "stormlight archive", score: 85 },
					{ bookName: "three body problem", score: 85 },
				],
				wordCounts: [
					{ bookName: "brave new world", count: 64000 },
					{ bookName: "the lord of the rings", count: 470000 },
					{ bookName: "three body problem", count: 150000 },
					{ bookName: "stormlight archive", count: 400000 },
				],
			};

			const result = parser.parse(input, BookAnalysisSchema);
			expect(result).toEqual(expected);
		});

		// Rust test: test_partial_analysis_2
		test("should parse partial book analysis", () => {
			const input = `\`\`\`json
      {
        "bookNames": [
          "brave new world",
          "the lord of the rings",
          "three body problem",
          "stormlight archive"
        ],
        "popularityData": [
          {
            "bookName": "brave new world",
            "scores": [
              {"year": 1950, "score": 70},`;

			const expected = {
				bookNames: [
					"brave new world",
					"the lord of the rings",
					"three body problem",
					"stormlight archive",
				],
				popularityOverTime: [
					{
						bookName: "brave new world",
						scores: [{ year: 1950, score: 70 }],
					},
				],
				popularityRankings: [],
				wordCounts: [],
			};

			const result = parser.parse(input, BookAnalysisSchema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});

		// Rust test: test_partial_choppy
		test("should parse partial graph JSON", () => {
			const input = `\`\`\`json
      {
        "vertices": [
          {
            "id": "stephanie_morales",
            "metadata": {
              "name": "Stephanie Morales",
              "affiliation": "Made Space"
            }
          },
          {
            "id":`;

			const expected: z.infer<typeof PartialGraphJsonSchema> = {
				vertices: [
					{
						id: "stephanie_morales",
						metadata: {
							name: "Stephanie Morales",
							affiliation: "Made Space",
						},
					},
					{
						id: null,
						metadata: {},
					},
				],
				edges: [],
			};

			const result = parser.parse(input, PartialGraphJsonSchema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});

		// Rust test: test_partial_choppy_union
		test("should parse partial graph from complex union type", () => {
			const ComplexUnionSchema = z.union([
				PartialGraphJsonSchema,
				z.array(PartialGraphJsonSchema),
				ErrorSchema,
			]);
			const input = `\`\`\`json
      {
        "vertices": [
          {
            "id": "stephanie_morales",
            "metadata": {
              "name": "Stephanie Morales",
              "affiliation": "Made Space"
            }
          },
          {
            "id":`;

			const expected: z.infer<typeof PartialGraphJsonSchema> = {
				vertices: [
					{
						id: "stephanie_morales",
						metadata: {
							name: "Stephanie Morales",
							affiliation: "Made Space",
						},
					},
					{
						id: null,
						metadata: {},
					},
				],
				edges: [],
			};

			const result = parser.parse(input, ComplexUnionSchema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});

		// Rust test: test_partial_choppy_union_2
		test("should parse partial graph from union type", () => {
			const PartialUnionSchema = z.union([
				PartialGraphJsonSchema,
				ErrorBasicSchema,
			]);
			const input = `\`\`\`json
      {
        "vertices": [
          {
            "id": "stephanie_morales",
            "metadata": {
              "name": "Stephanie Morales",
              "affiliation": "Made Space"
            }
          },
          {
            "id":`;

			const expected: z.infer<typeof PartialGraphJsonSchema> = {
				vertices: [
					{
						id: "stephanie_morales",
						metadata: {
							name: "Stephanie Morales",
							affiliation: "Made Space",
						},
					},
					{
						id: null,
						metadata: {},
					},
				],
				edges: [],
			};

			const result = parser.parse(input, PartialUnionSchema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});
	});

	// ================================================================
	// ADDITIONAL TYPESCRIPT TESTS: These tests extend beyond the Rust implementation
	// ================================================================

	describe("Additional TypeScript Tests", () => {
		const SimpleObjectSchema = z.object({
			name: z.string(),
			value: z.number(),
			items: z.array(z.string()),
		});

		test("should handle incomplete object", () => {
			const input = '{"name": "test", "value": 42, "items": ["one", "two"';

			const expected = {
				name: "test",
				value: 42,
				items: ["one", "two"],
			};

			const result = parser.parse(input, SimpleObjectSchema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});

		test("should handle incomplete array", () => {
			const input =
				'{"name": "test", "value": 42, "items": ["one", "two", "three"';

			const expected = {
				name: "test",
				value: 42,
				items: ["one", "two", "three"],
			};

			const result = parser.parse(input, SimpleObjectSchema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});

		test("should handle incomplete string value", () => {
			const input = '{"name": "test string that is not terminated';

			const expected = {
				name: "test string that is not terminated",
				value: null,
				items: [],
			};

			const result = parser.parse(
				input,
				SimpleObjectSchema.partial().extend({
					value: z.number().nullable(),
				}),
				{
					allowPartial: true,
				},
			);
			expect(result).toEqual(expected);
		});

		const ResumeSchema = z.object({
			name: z.string().nullable(),
			email: z.string().nullable(),
			phone: z.string().nullable(),
			experience: z.array(z.string()),
			education: z.array(
				z.object({
					school: z.string(),
					degree: z.string(),
					year: z.number(),
				}),
			),
			skills: z.array(z.string()),
		});

		test("should parse partial resume with incomplete experience", () => {
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

			const result = parser.parse(input, ResumeSchema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});

		test("should parse partial resume starting with experience", () => {
			const input = `{
        "experience": [
          "Senior Minister of Singapore since 2024",
          "Prime Minister of Singapore from 2004 to `;

			const expected = {
				name: null,
				email: null,
				phone: null,
				experience: [
					"Senior Minister of Singapore since 2024",
					"Prime Minister of Singapore from 2004 to ",
				],
				education: [],
				skills: [],
			};

			const result = parser.parse(input, ResumeSchema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});

		const TestSchema = z.object({
			foo1: z.object({
				field1: z.string().nullable(),
				field2: z.string().nullable(),
				field3: z.string().nullable(),
			}),
			foo2: z.array(
				z.object({
					field7: z.string().nullable(),
					field8: z.string().nullable(),
				}),
			),
			foo3: z.object({
				field28: z.string().nullable(),
				field29: z.array(z.string()),
			}),
		});

		test("should recover from malformed JSON sequence", () => {
			const input = `\`\`\`json
{
  "foo1": {
    "field1": "Something horrible has happened!!",
    "field2": null,
    "field3": null
  },
  "foo2": {
    "field7": null,
    "field8": null{
  "foo1": {
    "field1": "A thing has been going on poorly",
    "field2": null,
    "field3": null
  },
  "foo2": [{
    "field26": "The bad thing is confirmed.",
    "field27": null
  }],
  "foo3": {
    "field28": "We are really going to try and take care of the bad thing.",
    "field29": []
  }
}`;

			// Parser should recover and parse what it can
			const result = parser.parse(input, TestSchema, {
				allowPartial: true,
				allowMalformed: true,
			});

			// Should parse the most complete valid structure
			expect(result).toHaveProperty("foo1");
			expect(result).toHaveProperty("foo2");
			expect(result).toHaveProperty("foo3");
		});
	});
});
