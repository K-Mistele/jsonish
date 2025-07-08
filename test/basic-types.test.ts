import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { createParser } from '../src/parser';

const parser = createParser();

describe('Basic Types', () => {
  describe('String Parsing', () => {
    it('should parse a simple string', () => {
      const schema = z.string();
      const input = 'hello';
      const expected = 'hello';
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse a quoted string', () => {
      const schema = z.string();
      const input = '"hello"';
      const expected = '"hello"';
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse a string from an object when expecting string', () => {
      const schema = z.string();
      const input = '{"hi": "hello"}';
      const expected = '{"hi": "hello"}';
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse a string from mixed content', () => {
      const schema = z.string();
      const input = 'The output is: {"hello": "world"}';
      const expected = 'The output is: {"hello": "world"}';
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should handle strings with escaped quotes', () => {
      const schema = z.string();
      const input = '"hello \\"world\\""';
      const expected = '"hello \\"world\\""';
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });
  });

  describe('Number Parsing', () => {
    it('should parse a simple integer', () => {
      const schema = z.number();
      const input = '12111';
      const expected = 12111;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse a comma-separated integer', () => {
      const schema = z.number();
      const input = '12,111';
      const expected = 12111;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse a float', () => {
      const schema = z.number();
      const input = '12111.123';
      const expected = 12111.123;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse a comma-separated float (US format)', () => {
      const schema = z.number();
      const input = '12,111.123';
      const expected = 12111.123;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse a fraction as a float', () => {
      const schema = z.number();
      const input = '1/5';
      const expected = 0.2;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse currency-like numbers', () => {
      const schema = z.number();
      const input = '$1,234.56';
      const expected = 1234.56;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse numbers from strings containing text', () => {
      const schema = z.number();
      const input = '1 cup unsalted butter, room temperature';
      const expected = 1.0;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });
  });

  describe('Boolean Parsing', () => {
    it('should parse true', () => {
      const schema = z.boolean();
      const input = 'true';
      const expected = true;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse false', () => {
      const schema = z.boolean();
      const input = 'false';
      const expected = false;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse True (capitalized)', () => {
      const schema = z.boolean();
      const input = 'True';
      const expected = true;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse False (capitalized)', () => {
      const schema = z.boolean();
      const input = 'False';
      const expected = false;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should extract boolean from text', () => {
      const schema = z.boolean();
      const input = 'The answer is true';
      const expected = true;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should handle case-insensitive boolean in text', () => {
      const schema = z.boolean();
      const input = 'The answer is True';
      const expected = true;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should extract boolean from markdown text', () => {
      const schema = z.boolean();
      const input = 'The tax return you provided has section for dependents.\n\nAnswer: **True**';
      const expected = true;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should extract boolean followed by explanation', () => {
      const schema = z.boolean();
      const input = 'False.\\n\\nThe statement "2 + 2 = 5" is mathematically incorrect. The correct sum of 2 + 2 is 4, not 5.';
      const expected = false;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });
  });

  describe('Null Parsing', () => {
    it('should parse null', () => {
      const schema = z.null();
      const input = 'null';
      const expected = null;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should parse null for optional string', () => {
      const schema = z.string().nullable();
      const input = 'null';
      const expected = null;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should treat "Null" as string when targeting optional string', () => {
      const schema = z.string().nullable();
      const input = 'Null';
      const expected = 'Null';
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should treat "None" as string when targeting optional string', () => {
      const schema = z.string().nullable();
      const input = 'None';
      const expected = 'None';
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });
  });

  describe('Type Coercion', () => {
    it('should coerce number to string', () => {
      const schema = z.string();
      const input = '1';
      const expected = '1';
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should coerce string to number', () => {
      const schema = z.number();
      const input = '"123"';
      const expected = 123;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });

    it('should coerce string to boolean', () => {
      const schema = z.boolean();
      const input = '"true"';
      const expected = true;
      
      const result = parser.parse(input, schema);
      expect(result).toBe(expected);
    });
  });
});