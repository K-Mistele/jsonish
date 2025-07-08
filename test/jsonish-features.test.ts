import { test, expect, describe } from 'bun:test';
import { parseJSONish } from '../src/index.js';

describe('JSONish Features (LLM-focused)', () => {
  describe('Trailing Commas', () => {
    test('should handle trailing comma in object', () => {
      const result = parseJSONish('{"name": "test", "age": 30,}');
      expect(result).toEqual({ name: 'test', age: 30 });
    });

    test('should handle trailing comma in array', () => {
      const result = parseJSONish('[1, 2, 3,]');
      expect(result).toEqual([1, 2, 3]);
    });

    test('should handle multiple trailing commas', () => {
      const result = parseJSONish('{"a": 1,, "b": 2,}');
      expect(result).toEqual({ a: 1, b: 2 });
    });

    test('should handle trailing comma in nested structure', () => {
      const result = parseJSONish('{"users": [{"id": 1,}, {"id": 2,}],}');
      expect(result).toEqual({ users: [{ id: 1 }, { id: 2 }] });
    });
  });

  describe('Unquoted Keys', () => {
    test('should handle unquoted keys in object', () => {
      const result = parseJSONish('{name: "test", age: 30}');
      expect(result).toEqual({ name: 'test', age: 30 });
    });

    test('should handle mixed quoted and unquoted keys', () => {
      const result = parseJSONish('{name: "test", "age": 30, active: true}');
      expect(result).toEqual({ name: 'test', age: 30, active: true });
    });

    test('should handle unquoted keys with special characters', () => {
      const result = parseJSONish('{user_id: 1, user-name: "test"}');
      expect(result).toEqual({ user_id: 1, 'user-name': 'test' });
    });
  });

  describe('Comments', () => {
    test('should handle single-line comments', () => {
      const result = parseJSONish(`{
        "name": "test", // This is a comment
        "age": 30
      }`);
      expect(result).toEqual({ name: 'test', age: 30 });
    });

    test('should handle multi-line comments', () => {
      const result = parseJSONish(`{
        "name": "test", /* This is a
           multi-line comment */
        "age": 30
      }`);
      expect(result).toEqual({ name: 'test', age: 30 });
    });

    test('should handle comments at the end', () => {
      const result = parseJSONish('{"name": "test"} // End comment');
      expect(result).toEqual({ name: 'test' });
    });
  });

  describe('Mixed Quote Types', () => {
    test('should handle single quotes for strings', () => {
      const result = parseJSONish("{'name': 'test', 'age': 30}");
      expect(result).toEqual({ name: 'test', age: 30 });
    });

    test('should handle mixed single and double quotes', () => {
      const result = parseJSONish(`{"name": 'test', 'age': "30"}`);
      expect(result).toEqual({ name: 'test', age: '30' });
    });

    test('should handle backticks for strings', () => {
      const result = parseJSONish('{"name": `test`, "message": `hello world`}');
      expect(result).toEqual({ name: 'test', message: 'hello world' });
    });
  });

  describe('Partial/Incomplete JSON', () => {
    test('should handle incomplete object', () => {
      const result = parseJSONish('{"name": "test", "age":');
      expect(result).toEqual({ name: 'test' });
    });

    test('should handle incomplete array', () => {
      const result = parseJSONish('[1, 2, 3');
      expect(result).toEqual([1, 2, 3]);
    });

    test('should handle incomplete string', () => {
      const result = parseJSONish('{"name": "test", "message": "hello wor');
      expect(result).toEqual({ name: 'test', message: 'hello wor' });
    });

    test('should handle missing closing braces', () => {
      const result = parseJSONish('{"user": {"name": "test", "age": 30}');
      expect(result).toEqual({ user: { name: 'test', age: 30 } });
    });
  });

  describe('Multiple JSON Objects', () => {
    test('should handle multiple objects separated by newlines', () => {
      const result = parseJSONish(`{"id": 1, "name": "first"}
      {"id": 2, "name": "second"}`);
      expect(result).toEqual([
        { id: 1, name: 'first' },
        { id: 2, name: 'second' }
      ]);
    });

    test('should handle multiple objects separated by commas', () => {
      const result = parseJSONish('{"a": 1}, {"b": 2}, {"c": 3}');
      expect(result).toEqual([
        { a: 1 },
        { b: 2 },
        { c: 3 }
      ]);
    });

    test('should handle mixed arrays and objects', () => {
      const result = parseJSONish(`[1, 2, 3]
      {"name": "test"}
      [4, 5, 6]`);
      expect(result).toEqual([
        [1, 2, 3],
        { name: 'test' },
        [4, 5, 6]
      ]);
    });
  });

  describe('Relaxed Number Formats', () => {
    test('should handle numbers with leading zeros', () => {
      const result = parseJSONish('{"value": 007}');
      expect(result).toEqual({ value: 7 });
    });

    test('should handle hexadecimal numbers', () => {
      const result = parseJSONish('{"value": 0xFF}');
      expect(result).toEqual({ value: 255 });
    });

    test('should handle infinity', () => {
      const result = parseJSONish('{"value": Infinity}');
      expect(result).toEqual({ value: Infinity });
    });

    test('should handle NaN', () => {
      const result = parseJSONish('{"value": NaN}');
      expect(result).toEqual({ value: NaN });
    });
  });

  describe('Flexible String Handling', () => {
    test('should handle strings without quotes when unambiguous', () => {
      const result = parseJSONish('{name: hello, age: 30}');
      expect(result).toEqual({ name: 'hello', age: 30 });
    });

    test('should handle multiline strings', () => {
      const result = parseJSONish(`{
        "message": "This is a
        multiline string"
      }`);
      expect(result).toEqual({ message: 'This is a\n        multiline string' });
    });

    test('should handle template literals', () => {
      const result = parseJSONish('{"message": `Hello ${name}!`}');
      expect(result).toEqual({ message: 'Hello ${name}!' });
    });
  });

  describe('LLM-specific Patterns', () => {
    test('should handle function call format', () => {
      const result = parseJSONish('function_name({"param1": "value1", "param2": 42})');
      expect(result).toEqual({ param1: 'value1', param2: 42 });
    });

    test('should handle JSON in markdown code blocks', () => {
      const result = parseJSONish('```json\n{"name": "test", "value": 42}\n```');
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    test('should handle prefixed JSON', () => {
      const result = parseJSONish('Here is the JSON: {"name": "test", "value": 42}');
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    test('should handle JSON with explanation', () => {
      const result = parseJSONish('{"name": "test", "value": 42} // This is the response');
      expect(result).toEqual({ name: 'test', value: 42 });
    });
  });

  describe('Python-like Syntax', () => {
    test('should handle True/False/None', () => {
      const result = parseJSONish('{"active": True, "inactive": False, "value": None}');
      expect(result).toEqual({ active: true, inactive: false, value: null });
    });

    test('should handle Python-style comments', () => {
      const result = parseJSONish(`{
        "name": "test",  # Python comment
        "value": 42
      }`);
      expect(result).toEqual({ name: 'test', value: 42 });
    });
  });

  describe('Whitespace Flexibility', () => {
    test('should handle missing spaces around colons', () => {
      const result = parseJSONish('{"name":"test","age":30}');
      expect(result).toEqual({ name: 'test', age: 30 });
    });

    test('should handle excessive whitespace', () => {
      const result = parseJSONish(`{
        
        "name"   :   "test"   ,
        
        "age"    :    30
        
      }`);
      expect(result).toEqual({ name: 'test', age: 30 });
    });
  });
});