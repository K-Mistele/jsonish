import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { createParser } from '../src/parser';

const parser = createParser();

describe('Literals', () => {
  describe('String Literals', () => {
    it('should parse exact string literal', () => {
      const schema = z.literal('hello');
      const input = '"hello"';
      const expected = 'hello';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse string literal without quotes', () => {
      const schema = z.literal('world');
      const input = 'world';
      const expected = 'world';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse string literal from mixed content', () => {
      const schema = z.literal('success');
      const input = 'The status is: success';
      const expected = 'success';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse string literal with special characters', () => {
      const schema = z.literal('hello-world_123');
      const input = '"hello-world_123"';
      const expected = 'hello-world_123';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse string literal from JSON object', () => {
      const schema = z.object({
        status: z.literal('active')
      });
      const input = '{"status": "active"}';
      const expected: { status: 'active' } = { status: 'active' };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Number Literals', () => {
    it('should parse exact number literal', () => {
      const schema = z.literal(42);
      const input = '42';
      const expected = 42;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse negative number literal', () => {
      const schema = z.literal(-10);
      const input = '-10';
      const expected = -10;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse float literal', () => {
      const schema = z.literal(3.14);
      const input = '3.14';
      const expected = 3.14;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse zero literal', () => {
      const schema = z.literal(0);
      const input = '0';
      const expected = 0;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse number literal from JSON object', () => {
      const schema = z.object({
        version: z.literal(1)
      });
      const input = '{"version": 1}';
      const expected: { version: 1 } = { version: 1 };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Boolean Literals', () => {
    it('should parse true literal', () => {
      const schema = z.literal(true);
      const input = 'true';
      const expected = true;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse false literal', () => {
      const schema = z.literal(false);
      const input = 'false';
      const expected = false;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse true literal with case variation', () => {
      const schema = z.literal(true);
      const input = 'True';
      const expected = true;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse false literal with case variation', () => {
      const schema = z.literal(false);
      const input = 'False';
      const expected = false;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse boolean literal from JSON object', () => {
      const schema = z.object({
        enabled: z.literal(true)
      });
      const input = '{"enabled": true}';
      const expected: { enabled: true } = { enabled: true };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Literal Unions', () => {
    it('should parse string literal union', () => {
      const schema = z.union([z.literal('red'), z.literal('green'), z.literal('blue')]);
      
      const redResult = parser.parse('red', schema);
      expect(redResult).toBe('red');
      
      const greenResult = parser.parse('"green"', schema);
      expect(greenResult).toBe('green');
      
      const blueResult = parser.parse('blue', schema);
      expect(blueResult).toBe('blue');
    });

    it('should parse number literal union', () => {
      const schema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
      
      const oneResult = parser.parse('1', schema);
      expect(oneResult).toBe(1);
      
      const twoResult = parser.parse('2', schema);
      expect(twoResult).toBe(2);
      
      const threeResult = parser.parse('3', schema);
      expect(threeResult).toBe(3);
    });

    it('should parse mixed literal union', () => {
      const schema = z.union([z.literal('auto'), z.literal(100), z.literal(true)]);
      
      const autoResult = parser.parse('auto', schema);
      expect(autoResult).toBe('auto');
      
      const numberResult = parser.parse('100', schema);
      expect(numberResult).toBe(100);
      
      const booleanResult = parser.parse('true', schema);
      expect(booleanResult).toBe(true);
    });

    it('should parse literal union from JSON object', () => {
      const schema = z.object({
        size: z.union([z.literal('small'), z.literal('medium'), z.literal('large')])
      });
      
      const input = '{"size": "medium"}';
      const expected = { size: 'medium' };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Literal Arrays', () => {
    it('should parse array of string literals', () => {
      const schema = z.array(z.literal('item'));
      const input = '["item", "item", "item"]';
      const expected = ['item', 'item', 'item'];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse array of number literals', () => {
      const schema = z.array(z.literal(42));
      const input = '[42, 42]';
      const expected = [42, 42];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse array of literal union', () => {
      const schema = z.array(z.union([z.literal('yes'), z.literal('no')]));
      const input = '["yes", "no", "yes"]';
      const expected = ['yes', 'no', 'yes'];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Literal Validation', () => {
    it('should handle exact match requirement', () => {
      const schema = z.literal('exact');
      const input = 'exact';
      const expected = 'exact';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle case sensitivity for string literals', () => {
      const schema = z.literal('CaseSensitive');
      const input = 'CaseSensitive';
      const expected = 'CaseSensitive';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle precision for number literals', () => {
      const schema = z.literal(1.5);
      const input = '1.5';
      const expected = 1.5;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should validate literal in complex object', () => {
      const schema = z.object({
        type: z.literal('user'),
        id: z.number(),
        active: z.literal(true)
      });
      
      const input = '{"type": "user", "id": 123, "active": true}';
      const expected = { type: 'user', id: 123, active: true };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Literal Error Handling', () => {
    it('should handle non-matching string literal gracefully', () => {
      const schema = z.literal('expected');
      const input = 'unexpected';
      
      // Should either coerce or handle gracefully
      expect(() => parser.parse(input, schema)).not.toThrow();
    });

    it('should handle non-matching number literal gracefully', () => {
      const schema = z.literal(42);
      const input = '43';
      
      // Should either coerce or handle gracefully
      expect(() => parser.parse(input, schema)).not.toThrow();
    });

    it('should handle type mismatch gracefully', () => {
      const schema = z.literal('string');
      const input = '123';
      
      // Should either coerce or handle gracefully
      expect(() => parser.parse(input, schema)).not.toThrow();
    });

    it('should handle empty input gracefully', () => {
      const schema = z.literal('value');
      const input = '';
      
      // Should handle empty input gracefully
      expect(() => parser.parse(input, schema)).not.toThrow();
    });
  });

  describe('Literal Extraction from Text', () => {
    it('should extract string literal from mixed content', () => {
      const schema = z.literal('approved');
      const input = 'The request has been approved by the system.';
      const expected = 'approved';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract number literal from text', () => {
      const schema = z.literal(404);
      const input = 'Error 404: Not Found';
      const expected = 404;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract boolean literal from text', () => {
      const schema = z.literal(true);
      const input = 'The statement is true.';
      const expected = true;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract literal from markdown', () => {
      const schema = z.literal('confirmed');
      const input = `
        Status update:
        \`\`\`
        confirmed
        \`\`\`
      `;
      const expected = 'confirmed';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Nested Literal Structures', () => {
    it('should handle nested object with literals', () => {
      const schema = z.object({
        metadata: z.object({
          version: z.literal('1.0'),
          type: z.literal('config')
        }),
        enabled: z.literal(true)
      });
      
      const input = `{
        "metadata": {
          "version": "1.0",
          "type": "config"
        },
        "enabled": true
      }`;
      
      const expected = {
        metadata: {
          version: '1.0',
          type: 'config'
        },
        enabled: true
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle array of objects with literals', () => {
      const schema = z.array(z.object({
        status: z.literal('active'),
        priority: z.literal(1)
      }));
      
      const input = `[
        {"status": "active", "priority": 1},
        {"status": "active", "priority": 1}
      ]`;
      
      const expected = [
        { status: 'active', priority: 1 },
        { status: 'active', priority: 1 }
      ];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });
});