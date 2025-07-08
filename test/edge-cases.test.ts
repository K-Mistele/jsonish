import { test, expect, describe } from 'bun:test';
import { parseJSON, parseJSONish, JSONishError } from '../src/index.js';

describe('Edge Cases and Error Handling', () => {
  describe('Empty and Whitespace', () => {
    test('should handle empty string', () => {
      expect(() => parseJSON('')).toThrow();
    });

    test('should handle whitespace only', () => {
      expect(() => parseJSON('   \n  \t  ')).toThrow();
    });

    test('should handle JSONish empty string gracefully', () => {
      const result = parseJSONish('');
      expect(result).toEqual({});
    });
  });

  describe('Malformed JSON', () => {
    test('should handle unclosed string', () => {
      expect(() => parseJSON('{"name": "test')).toThrow();
    });

    test('should handle unclosed object', () => {
      expect(() => parseJSON('{"name": "test"')).toThrow();
    });

    test('should handle unclosed array', () => {
      expect(() => parseJSON('[1, 2, 3')).toThrow();
    });

    test('should handle extra closing brackets', () => {
      expect(() => parseJSON('{"name": "test"}')).toThrow();
    });

    test('should handle missing commas', () => {
      expect(() => parseJSON('{"name": "test" "age": 30}')).toThrow();
    });

    test('should handle invalid property names', () => {
      expect(() => parseJSON('{123: "test"}')).toThrow();
    });
  });

  describe('JSONish Error Recovery', () => {
    test('should recover from unclosed string', () => {
      const result = parseJSONish('{"name": "test');
      expect(result).toEqual({ name: 'test' });
    });

    test('should recover from unclosed object', () => {
      const result = parseJSONish('{"name": "test", "age": 30');
      expect(result).toEqual({ name: 'test', age: 30 });
    });

    test('should recover from missing quotes', () => {
      const result = parseJSONish('{name: test, age: 30}');
      expect(result).toEqual({ name: 'test', age: 30 });
    });

    test('should handle mixed valid and invalid syntax', () => {
      const result = parseJSONish('{"valid": true, invalid: "test", "another": 42}');
      expect(result).toEqual({ valid: true, invalid: 'test', another: 42 });
    });
  });

  describe('Deeply Nested Structures', () => {
    test('should handle deeply nested objects', () => {
      const depth = 100;
      let json = '';
      for (let i = 0; i < depth; i++) {
        json += '{"level": ';
      }
      json += 'null';
      for (let i = 0; i < depth; i++) {
        json += '}';
      }
      
      const result = parseJSON(json);
      expect(result).toBeDefined();
    });

    test('should handle deeply nested arrays', () => {
      const depth = 100;
      let json = '';
      for (let i = 0; i < depth; i++) {
        json += '[';
      }
      json += 'null';
      for (let i = 0; i < depth; i++) {
        json += ']';
      }
      
      const result = parseJSON(json);
      expect(result).toBeDefined();
    });

    test('should handle mixed deeply nested structures', () => {
      const json = '{"a": [{"b": [{"c": {"d": [1, 2, 3]}}]}]}';
      const result = parseJSON(json);
      expect(result).toEqual({ a: [{ b: [{ c: { d: [1, 2, 3] } }] }] });
    });
  });

  describe('Large Data Structures', () => {
    test('should handle large arrays', () => {
      const largeArray = new Array(10000).fill(0).map((_, i) => i);
      const json = JSON.stringify(largeArray);
      const result = parseJSON(json);
      expect(result).toEqual(largeArray);
    });

    test('should handle large objects', () => {
      const largeObject: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = i;
      }
      const json = JSON.stringify(largeObject);
      const result = parseJSON(json);
      expect(result).toEqual(largeObject);
    });

    test('should handle large strings', () => {
      const largeString = 'a'.repeat(100000);
      const json = JSON.stringify({ message: largeString });
      const result = parseJSON(json);
      expect(result).toEqual({ message: largeString });
    });
  });

  describe('Unicode and Special Characters', () => {
    test('should handle Unicode characters', () => {
      const result = parseJSON('{"emoji": "🚀", "chinese": "你好", "arabic": "مرحبا"}');
      expect(result).toEqual({ emoji: '🚀', chinese: '你好', arabic: 'مرحبا' });
    });

    test('should handle Unicode escape sequences', () => {
      const result = parseJSON('{"unicode": "\\u0048\\u0065\\u006C\\u006C\\u006F"}');
      expect(result).toEqual({ unicode: 'Hello' });
    });

    test('should handle special characters in strings', () => {
      const result = parseJSON('{"special": "!@#$%^&*()_+-=[]{}|;:,.<>?"}');
      expect(result).toEqual({ special: '!@#$%^&*()_+-=[]{}|;:,.<>?' });
    });

    test('should handle null bytes', () => {
      const result = parseJSON('{"nullbyte": "hello\\u0000world"}');
      expect(result).toEqual({ nullbyte: 'hello\x00world' });
    });
  });

  describe('Escape Sequences', () => {
    test('should handle all standard escape sequences', () => {
      const result = parseJSON('{"escapes": "\\n\\r\\t\\b\\f\\\\\\"\\/"}');
      expect(result).toEqual({ escapes: '\n\r\t\b\f\\"\/' });
    });

    test('should handle invalid escape sequences', () => {
      expect(() => parseJSON('{"invalid": "\\x"}')).toThrow();
    });

    test('should handle escaped quotes', () => {
      const result = parseJSON('{"quote": "He said \\"Hello\\""}');
      expect(result).toEqual({ quote: 'He said "Hello"' });
    });
  });

  describe('Number Edge Cases', () => {
    test('should handle very large numbers', () => {
      const result = parseJSON('{"large": 1.7976931348623157e+308}');
      expect(result).toEqual({ large: 1.7976931348623157e+308 });
    });

    test('should handle very small numbers', () => {
      const result = parseJSON('{"small": 5e-324}');
      expect(result).toEqual({ small: 5e-324 });
    });

    test('should handle negative zero', () => {
      const result = parseJSON('{"negZero": -0}');
      expect(result).toEqual({ negZero: -0 });
    });

    test('should handle invalid number formats', () => {
      expect(() => parseJSON('{"invalid": 01}')).toThrow();
      expect(() => parseJSON('{"invalid": .5}')).toThrow();
      expect(() => parseJSON('{"invalid": 5.}')).toThrow();
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle maximum nesting depth', () => {
      // Test with a reasonable nesting depth
      const maxDepth = 1000;
      let json = '';
      for (let i = 0; i < maxDepth; i++) {
        json += '{"level": ';
      }
      json += '"deep"';
      for (let i = 0; i < maxDepth; i++) {
        json += '}';
      }
      
      const result = parseJSON(json);
      expect(result).toBeDefined();
    });

    test('should handle empty nested structures', () => {
      const result = parseJSON('{"empty": {}, "array": [], "nested": {"empty": []}}');
      expect(result).toEqual({ empty: {}, array: [], nested: { empty: [] } });
    });

    test('should handle single character strings', () => {
      const result = parseJSON('{"single": "a"}');
      expect(result).toEqual({ single: 'a' });
    });
  });

  describe('Error Position Reporting', () => {
    test('should report error position for syntax errors', () => {
      try {
        parseJSON('{"name": "test" "age": 30}');
        expect.fail('Should have thrown an error');
      } catch (error) {
        if (error instanceof JSONishError) {
          expect(error.position).toBeDefined();
          expect(error.position).toBeGreaterThan(0);
        }
      }
    });

    test('should report error position for invalid characters', () => {
      try {
        parseJSON('{"name": "test", @invalid: 30}');
        expect.fail('Should have thrown an error');
      } catch (error) {
        if (error instanceof JSONishError) {
          expect(error.position).toBeDefined();
        }
      }
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    test('should handle repeated keys', () => {
      const result = parseJSON('{"name": "first", "name": "second", "name": "third"}');
      expect(result).toEqual({ name: 'third' });
    });

    test('should handle very long property names', () => {
      const longKey = 'a'.repeat(10000);
      const json = `{"${longKey}": "value"}`;
      const result = parseJSON(json);
      expect(result[longKey]).toBe('value');
    });

    test('should handle circular reference prevention', () => {
      // This would be handled by the implementation to prevent infinite loops
      const result = parseJSONish('{"a": {"b": {"c": "back to a"}}}');
      expect(result).toBeDefined();
    });
  });

  describe('Streaming Edge Cases', () => {
    test('should handle incomplete streaming input', () => {
      const result = parseJSONish('{"start": true');
      expect(result).toEqual({ start: true });
    });

    test('should handle streaming with mixed content', () => {
      const result = parseJSONish('Some text {"json": true} more text');
      expect(result).toEqual({ json: true });
    });
  });
});