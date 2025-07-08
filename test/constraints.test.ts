import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createParser } from "../src/parser";

const parser = createParser();

describe("Constraints", () => {
	describe("Field-level Constraints", () => {
		// Schema with age and name constraints
		const FooSchema = z.object({
			age: z
				.number()
				.refine((val) => val >= 0, { message: "age must be non-negative" }),
			name: z
				.string()
				.refine((val) => val.length > 0, { message: "name must not be empty" }),
		});

		// Schema with multiple checks on age
		const FooWithMultipleChecksSchema = z.object({
			age: z
				.number()
				.refine((val) => val >= 0, { message: "age must be non-negative" })
				.refine((val) => val < 10, { message: "age must be less than 10" })
				.refine((val) => val < 20, { message: "age must be less than 20" }),
			name: z
				.string()
				.refine((val) => val.length > 0, { message: "name must not be empty" }),
		});

		test("should parse object passing all constraints", () => {
			const input = '{"age": 5, "name": "Greg"}';
			const expected = { age: 5, name: "Greg" };

			const result = parser.parse(input, FooWithMultipleChecksSchema);
			expect(result).toEqual(expected);
		});

		test("should handle object failing one check with warning", () => {
			const input = '{"age": 11, "name": "Greg"}';
			const expected = { age: 11, name: "Greg" };

			// In BAML, checks are warnings, so parsing succeeds
			// but the parser may have a lower confidence score
			const result = parser.parse(input, FooWithMultipleChecksSchema);
			expect(result).toEqual(expected);
		});

		test("should handle object failing two checks with warning", () => {
			const input = '{"age": 21, "name": "Grog"}';
			const expected = { age: 21, name: "Grog" };

			// Failing multiple checks still succeeds but with lower score
			const result = parser.parse(input, FooWithMultipleChecksSchema);
			expect(result).toEqual(expected);
		});

		test("should fail on object failing assert (negative age)", () => {
			const input = '{"age": -1, "name": "Sam"}';

			// Asserts are hard failures in BAML
			expect(() => parser.parse(input, FooSchema)).toThrow();
		});

		test("should fail on object failing multiple asserts", () => {
			const input = '{"age": -1, "name": ""}';

			// Multiple assert failures
			expect(() => parser.parse(input, FooSchema)).toThrow();
		});
	});

	describe("Union Constraints", () => {
		// Schemas for union with different constraints
		const Thing1Schema = z.object({
			bar: z.number().refine((val) => val < 10, {
				message: "bar must be small (< 10)",
			}),
		});

		const Thing2Schema = z.object({
			bar: z.number().refine((val) => val > 20, {
				message: "bar must be big (> 20)",
			}),
		});

		const EitherSchema = z.object({
			bar: z.union([Thing1Schema, Thing2Schema]),
			things: z
				.array(z.union([Thing1Schema, Thing2Schema]))
				.refine((val) => val.length < 4, {
					message: "list must not be too long",
				}),
		});

		test("should select union variant based on check (small value)", () => {
			const input = '{"bar": 5, "things":[]}';
			const expected = {
				bar: { bar: 5 }, // Thing1 selected
				things: [],
			};

			const result = parser.parse(input, EitherSchema);
			expect(result).toEqual(expected);
		});

		test("should handle ambiguous union value", () => {
			const input = '{"bar": 15, "things":[]}';
			const expected = {
				bar: { bar: 15 }, // Neither constraint fully satisfied
				things: [],
			};

			// Parser should still succeed but may choose arbitrarily
			const result = parser.parse(input, EitherSchema);
			expect(result).toEqual(expected);
		});

		test("should fail on list length assert", () => {
			const input =
				'{"bar": 1, "things":[{"bar": 25}, {"bar": 35}, {"bar": 15}, {"bar": 15}]}';

			// List is too long (4 items, max is 3)
			expect(() => parser.parse(input, EitherSchema)).toThrow();
		});
	});

	describe("Map Constraints", () => {
		const MapWithCheckSchema = z.object({
			foo: z.record(z.string(), z.number()).refine((val) => val.hello === 10, {
				message: "hello key must equal 10",
			}),
		});

		test("should parse map passing check", () => {
			const input = '{"foo": {"hello": 10, "there": 13}}';
			const expected = {
				foo: { hello: 10, there: 13 },
			};

			const result = parser.parse(input, MapWithCheckSchema);
			expect(result).toEqual(expected);
		});

		test("should handle map failing check with warning", () => {
			const input = '{"foo": {"hello": 11, "there": 13}}';
			const expected = {
				foo: { hello: 11, there: 13 },
			};

			// Check failures are warnings, so parsing succeeds
			const result = parser.parse(input, MapWithCheckSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Nested Class Constraints", () => {
		const InnerSchema = z.object({
			value: z.number().refine((val) => val < 10, {
				message: "value must be less than 10",
			}),
		});

		const OuterSchema = z.object({
			inner: InnerSchema,
		});

		test("should handle nested class constraint failure with warning", () => {
			const input = '{"inner": {"value": 15}}';
			const expected = {
				inner: { value: 15 },
			};

			// Check failure in nested class is still a warning
			const result = parser.parse(input, OuterSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Block-level Constraints", () => {
		// Schema with object-level validation
		const FooWithBlockAssertSchema = z
			.object({
				foo: z.number(),
			})
			.refine((val) => val.foo > 0, {
				message: "foo must be positive",
			});

		test("should fail block-level assert", () => {
			const input = '{"foo": -1}';

			// Block-level assert failure
			expect(() => parser.parse(input, FooWithBlockAssertSchema)).toThrow();
		});

		test("should pass block-level assert", () => {
			const input = '{"foo": 1}';
			const expected = { foo: 1 };

			const result = parser.parse(input, FooWithBlockAssertSchema);
			expect(result).toEqual(expected);
		});

		// Enum with block-level constraint
		const MyEnumSchema = z
			.enum(["ONE", "TWO", "THREE"])
			.refine((val) => val === "TWO", {
				message: "enum must be TWO",
			});

		test("should fail enum block-level assert", () => {
			const input = "THREE";

			expect(() => parser.parse(input, MyEnumSchema)).toThrow();
		});

		test("should pass enum block-level assert", () => {
			const input = "TWO";
			const expected = "TWO";

			const result = parser.parse(input, MyEnumSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Multiple Block-level Constraints", () => {
		// Schema with conflicting block-level asserts
		const FooWithConflictingAssertsSchema = z
			.object({
				foo: z.number(),
			})
			.refine((val) => val.foo < 0, { message: "foo must be negative" })
			.refine((val) => val.foo > 0, { message: "foo must be positive" });

		test("should fail when value doesn't satisfy all block asserts", () => {
			const input = '{"foo": 1}';

			// Value is positive, fails first assert
			expect(() =>
				parser.parse(input, FooWithConflictingAssertsSchema),
			).toThrow();
		});

		test("should fail when value is zero", () => {
			const input = '{"foo": 0}';

			// Zero fails both asserts
			expect(() =>
				parser.parse(input, FooWithConflictingAssertsSchema),
			).toThrow();
		});
	});
});
