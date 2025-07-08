import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { createParser } from '../src/parser';

const parser = createParser();

describe('Arrays', () => {
  describe('Basic Array Parsing', () => {
    it('should parse an array of integers', () => {
      const schema = z.array(z.number());
      const input = '[1, 2, 3]';
      const expected = [1, 2, 3];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse an array of strings', () => {
      const schema = z.array(z.string());
      const input = '["hello", "world", "test"]';
      const expected = ["hello", "world", "test"];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse an array of booleans', () => {
      const schema = z.array(z.boolean());
      const input = '[true, false, true]';
      const expected = [true, false, true];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse an empty array', () => {
      const schema = z.array(z.string());
      const input = '[]';
      const expected: string[] = [];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Type Coercion in Arrays', () => {
    it('should coerce numbers to strings in string array', () => {
      const schema = z.array(z.string());
      const input = '[1, 2, 3]';
      const expected = ["1", "2", "3"];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should coerce strings to numbers in number array', () => {
      const schema = z.array(z.number());
      const input = '["1", "2", "3"]';
      const expected = [1, 2, 3];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should coerce mixed types to floats', () => {
      const schema = z.array(z.number());
      const input = '[1, 2.5, "3"]';
      const expected = [1, 2.5, 3];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Single Value to Array Coercion', () => {
    it('should wrap single string in array when expecting string array', () => {
      const schema = z.array(z.string());
      const input = '"hello"';
      const expected = ["hello"];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should wrap single number in array when expecting number array', () => {
      const schema = z.array(z.number());
      const input = '42';
      const expected = [42];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should wrap single boolean in array when expecting boolean array', () => {
      const schema = z.array(z.boolean());
      const input = 'true';
      const expected = [true];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract boolean from text into array', () => {
      const schema = z.array(z.boolean());
      const input = 'The answer is true';
      const expected = [true];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Nested Arrays', () => {
    it('should parse nested number arrays', () => {
      const schema = z.array(z.array(z.number()));
      const input = '[[1, 2], [3, 4], [5, 6]]';
      const expected = [[1, 2], [3, 4], [5, 6]];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse nested string arrays', () => {
      const schema = z.array(z.array(z.string()));
      const input = '[["a", "b"], ["c", "d"]]';
      const expected = [["a", "b"], ["c", "d"]];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle deeply nested arrays', () => {
      const schema = z.array(z.array(z.array(z.number())));
      const input = '[[[1]], [[2, 3]], [[4, 5, 6]]]';
      const expected = [[[1]], [[2, 3]], [[4, 5, 6]]];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Malformed Array Handling', () => {
    it('should handle array with trailing comma', () => {
      const schema = z.array(z.number());
      const input = '[1, 2, 3,]';
      const expected = [1, 2, 3];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle incomplete array', () => {
      const schema = z.array(z.number());
      const input = '[1, 2, 3';
      const expected = [1, 2, 3];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle array with unquoted strings', () => {
      const schema = z.array(z.string());
      const input = '[hello, world, test]';
      const expected = ["hello", "world", "test"];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle array with mixed quotes', () => {
      const schema = z.array(z.string());
      const input = '["hello", \'world\', test]';
      const expected = ["hello", "world", "test"];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Union Arrays', () => {
    it('should parse array of string or number union', () => {
      const schema = z.array(z.union([z.string(), z.number()]));
      const input = '["hello", 42, "world", 123]';
      const expected = ["hello", 42, "world", 123];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse array of object unions', () => {
      const schema = z.array(z.union([
        z.object({ type: z.literal("text"), content: z.string() }),
        z.object({ type: z.literal("number"), value: z.number() })
      ]));
      const input = '[{"type": "text", "content": "hello"}, {"type": "number", "value": 42}]';
      const expected = [
        { type: "text" as const, content: "hello" },
        { type: "number" as const, value: 42 }
      ];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Arrays from Mixed Content', () => {
    it('should extract array from text with prefix', () => {
      const schema = z.array(z.number());
      const input = 'Here are the numbers: [1, 2, 3]';
      const expected = [1, 2, 3];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract array from markdown code block', () => {
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

    it('should handle multiple arrays in text (choose first)', () => {
      const schema = z.array(z.number());
      const input = 'First array: [1, 2, 3] and second array: [4, 5, 6]';
      const expected = [1, 2, 3];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Complex Array Content', () => {
    it('should parse array with objects', () => {
      const schema = z.array(z.object({
        name: z.string(),
        age: z.number()
      }));
      const input = '[{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]';
      const expected = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 }
      ];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse array with nested objects and arrays', () => {
      const schema = z.array(z.object({
        id: z.number(),
        tags: z.array(z.string()),
        metadata: z.object({
          created: z.string(),
          active: z.boolean()
        })
      }));
      const input = `[
        {
          "id": 1,
          "tags": ["important", "urgent"],
          "metadata": {"created": "2023-01-01", "active": true}
        },
        {
          "id": 2,
          "tags": ["normal"],
          "metadata": {"created": "2023-01-02", "active": false}
        }
      ]`;
      const expected = [
        {
          id: 1,
          tags: ["important", "urgent"],
          metadata: { created: "2023-01-01", active: true }
        },
        {
          id: 2,
          tags: ["normal"],
          metadata: { created: "2023-01-02", active: false }
        }
      ];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });
});