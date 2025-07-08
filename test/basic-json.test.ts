import { test, expect, describe } from 'bun:test';
import { parseJSON } from '../src/index.js';

describe('Basic JSON Parsing', () => {
  describe('Simple Objects', () => {
    test('should parse empty object', () => {
      const result = parseJSON('{}');
      expect(result).toEqual({});
    });

    test('should parse object with string property', () => {
      const result = parseJSON('{"name": "test"}');
      expect(result).toEqual({ name: 'test' });
    });

    test('should parse object with multiple properties', () => {
      const result = parseJSON('{"name": "test", "age": 30, "active": true}');
      expect(result).toEqual({ name: 'test', age: 30, active: true });
    });

    test('should parse object with null value', () => {
      const result = parseJSON('{"value": null}');
      expect(result).toEqual({ value: null });
    });
  });

  describe('Arrays', () => {
    test('should parse empty array', () => {
      const result = parseJSON('[]');
      expect(result).toEqual([]);
    });

    test('should parse array with single element', () => {
      const result = parseJSON('[1]');
      expect(result).toEqual([1]);
    });

    test('should parse array with multiple elements', () => {
      const result = parseJSON('[1, "hello", true, null]');
      expect(result).toEqual([1, 'hello', true, null]);
    });

    test('should parse array of objects', () => {
      const result = parseJSON('[{"id": 1}, {"id": 2}]');
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('Numbers', () => {
    test('should parse integer', () => {
      const result = parseJSON('42');
      expect(result).toBe(42);
    });

    test('should parse negative integer', () => {
      const result = parseJSON('-42');
      expect(result).toBe(-42);
    });

    test('should parse float', () => {
      const result = parseJSON('3.14');
      expect(result).toBe(3.14);
    });

    test('should parse scientific notation', () => {
      const result = parseJSON('1.23e-4');
      expect(result).toBe(1.23e-4);
    });

    test('should parse zero', () => {
      const result = parseJSON('0');
      expect(result).toBe(0);
    });
  });

  describe('Strings', () => {
    test('should parse empty string', () => {
      const result = parseJSON('""');
      expect(result).toBe('');
    });

    test('should parse simple string', () => {
      const result = parseJSON('"hello"');
      expect(result).toBe('hello');
    });

    test('should parse string with spaces', () => {
      const result = parseJSON('"hello world"');
      expect(result).toBe('hello world');
    });

    test('should parse string with escape sequences', () => {
      const result = parseJSON('"hello\\nworld"');
      expect(result).toBe('hello\nworld');
    });

    test('should parse string with quotes', () => {
      const result = parseJSON('"He said \\"hello\\""');
      expect(result).toBe('He said "hello"');
    });

    test('should parse string with backslashes', () => {
      const result = parseJSON('"C:\\\\path\\\\to\\\\file"');
      expect(result).toBe('C:\\path\\to\\file');
    });
  });

  describe('Booleans', () => {
    test('should parse true', () => {
      const result = parseJSON('true');
      expect(result).toBe(true);
    });

    test('should parse false', () => {
      const result = parseJSON('false');
      expect(result).toBe(false);
    });
  });

  describe('Null', () => {
    test('should parse null', () => {
      const result = parseJSON('null');
      expect(result).toBe(null);
    });
  });

  describe('Nested Structures', () => {
    test('should parse nested object', () => {
      const result = parseJSON('{"user": {"name": "John", "age": 30}}');
      expect(result).toEqual({ user: { name: 'John', age: 30 } });
    });

    test('should parse nested array', () => {
      const result = parseJSON('[[1, 2], [3, 4]]');
      expect(result).toEqual([[1, 2], [3, 4]]);
    });

    test('should parse complex nested structure', () => {
      const result = parseJSON(`{
        "users": [
          {"id": 1, "name": "John", "settings": {"theme": "dark"}},
          {"id": 2, "name": "Jane", "settings": {"theme": "light"}}
        ],
        "meta": {"count": 2}
      }`);
      expect(result).toEqual({
        users: [
          { id: 1, name: 'John', settings: { theme: 'dark' } },
          { id: 2, name: 'Jane', settings: { theme: 'light' } }
        ],
        meta: { count: 2 }
      });
    });
  });

  describe('Whitespace Handling', () => {
    test('should handle whitespace in object', () => {
      const result = parseJSON('  {  "name"  :  "test"  }  ');
      expect(result).toEqual({ name: 'test' });
    });

    test('should handle whitespace in array', () => {
      const result = parseJSON('  [  1  ,  2  ,  3  ]  ');
      expect(result).toEqual([1, 2, 3]);
    });

    test('should handle newlines and tabs', () => {
      const result = parseJSON(`{
        "name": "test",
        "value": 42
      }`);
      expect(result).toEqual({ name: 'test', value: 42 });
    });
  });
});