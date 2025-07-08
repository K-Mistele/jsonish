import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { createParser } from '../src/parser';

const parser = createParser();

describe('Maps', () => {
  describe('Basic Map Parsing', () => {
    it('should parse simple string-keyed map', () => {
      const schema = z.record(z.string());
      const input = '{"key1": "value1", "key2": "value2"}';
      const expected = { key1: "value1", key2: "value2" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse number-valued map', () => {
      const schema = z.record(z.number());
      const input = '{"count": 42, "total": 100}';
      const expected = { count: 42, total: 100 };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse boolean-valued map', () => {
      const schema = z.record(z.boolean());
      const input = '{"enabled": true, "visible": false}';
      const expected = { enabled: true, visible: false };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse empty map', () => {
      const schema = z.record(z.string());
      const input = '{}';
      const expected = {};
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Dynamic Keys', () => {
    it('should handle dynamic string keys', () => {
      const schema = z.record(z.string());
      const input = '{"dynamic-key": "value", "another_key": "another_value"}';
      const expected = { "dynamic-key": "value", "another_key": "another_value" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle keys with special characters', () => {
      const schema = z.record(z.string());
      const input = '{"key.with.dots": "value1", "key-with-dashes": "value2", "key_with_underscores": "value3"}';
      const expected = { 
        "key.with.dots": "value1", 
        "key-with-dashes": "value2", 
        "key_with_underscores": "value3" 
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle numeric-like keys as strings', () => {
      const schema = z.record(z.string());
      const input = '{"123": "numeric key", "456": "another numeric key"}';
      const expected = { "123": "numeric key", "456": "another numeric key" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle whitespace in keys', () => {
      const schema = z.record(z.string());
      const input = '{"key with spaces": "value1", " leading space": "value2"}';
      const expected = { "key with spaces": "value1", " leading space": "value2" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Typed Values', () => {
    it('should parse map with object values', () => {
      const schema = z.record(z.object({
        name: z.string(),
        age: z.number()
      }));
      const input = `{
        "person1": {"name": "Alice", "age": 30},
        "person2": {"name": "Bob", "age": 25}
      }`;
      const expected = {
        person1: { name: "Alice", age: 30 },
        person2: { name: "Bob", age: 25 }
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse map with array values', () => {
      const schema = z.record(z.array(z.string()));
      const input = `{
        "fruits": ["apple", "banana", "orange"],
        "vegetables": ["carrot", "broccoli"]
      }`;
      const expected = {
        fruits: ["apple", "banana", "orange"],
        vegetables: ["carrot", "broccoli"]
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse map with union values', () => {
      const schema = z.record(z.union([z.string(), z.number()]));
      const input = '{"text": "hello", "number": 42, "another": "world"}';
      const expected = { text: "hello", number: 42, another: "world" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse map with optional values', () => {
      const schema = z.record(z.string().optional());
      const input = '{"key1": "value1", "key2": null}';
      const expected = { key1: "value1", key2: undefined };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Nested Maps', () => {
    it('should parse nested maps', () => {
      const schema = z.record(z.record(z.string()));
      const input = `{
        "level1": {
          "level2a": "value1",
          "level2b": "value2"
        },
        "another": {
          "nested": "value3"
        }
      }`;
      const expected = {
        level1: {
          level2a: "value1",
          level2b: "value2"
        },
        another: {
          nested: "value3"
        }
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse map with nested objects', () => {
      const schema = z.record(z.object({
        metadata: z.record(z.string()),
        value: z.number()
      }));
      const input = `{
        "item1": {
          "metadata": {"type": "A", "category": "test"},
          "value": 100
        },
        "item2": {
          "metadata": {"type": "B"},
          "value": 200
        }
      }`;
      const expected = {
        item1: {
          metadata: { type: "A", category: "test" },
          value: 100
        },
        item2: {
          metadata: { type: "B" },
          value: 200
        }
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Map from Object Coercion', () => {
    it('should coerce object to map', () => {
      const schema = z.record(z.string());
      const input = '{"a": "1", "b": "2", "c": "3"}';
      const expected = { a: "1", b: "2", c: "3" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle mixed object to map coercion', () => {
      const schema = z.record(z.union([z.string(), z.number()]));
      const input = '{"string": "hello", "number": 42, "another": "world"}';
      const expected = { string: "hello", number: 42, another: "world" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Map Validation', () => {
    it('should validate map with string values', () => {
      const schema = z.record(z.string().min(3));
      const input = '{"key1": "hello", "key2": "world"}';
      const expected = { key1: "hello", key2: "world" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should validate map with number constraints', () => {
      const schema = z.record(z.number().min(0).max(100));
      const input = '{"score1": 85, "score2": 92}';
      const expected = { score1: 85, score2: 92 };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should validate map with enum values', () => {
      const schema = z.record(z.enum(['active', 'inactive', 'pending']));
      const input = '{"user1": "active", "user2": "pending"}';
      const expected: Record<string, 'active' | 'inactive' | 'pending'> = { user1: "active", user2: "pending" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Map Error Handling', () => {
    it('should handle malformed map gracefully', () => {
      const schema = z.record(z.string());
      const input = '{"key": "value",}'; // trailing comma
      
      // Should not throw and should return something reasonable
      expect(() => parser.parse(input, schema)).not.toThrow();
    });

    it('should handle incomplete map gracefully', () => {
      const schema = z.record(z.string());
      const input = '{"key": "value"'; // missing closing brace
      
      // Should not throw and should return something reasonable
      expect(() => parser.parse(input, schema)).not.toThrow();
    });

    it('should handle empty input gracefully', () => {
      const schema = z.record(z.string());
      const input = '';
      
      // Should handle empty input gracefully
      expect(() => parser.parse(input, schema)).not.toThrow();
    });

    it('should handle invalid JSON gracefully', () => {
      const schema = z.record(z.string());
      const input = 'not json at all';
      
      // Should handle invalid JSON gracefully
      expect(() => parser.parse(input, schema)).not.toThrow();
    });
  });

  describe('Map from Mixed Content', () => {
    it('should extract map from text with prefix', () => {
      const schema = z.record(z.string());
      const input = 'The configuration is: {"debug": "true", "mode": "production"}';
      const expected = { debug: "true", mode: "production" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract map from markdown code block', () => {
      const schema = z.record(z.number());
      const input = `
        Configuration:
        \`\`\`json
        {
          "maxRetries": 3,
          "timeout": 5000
        }
        \`\`\`
      `;
      const expected = { maxRetries: 3, timeout: 5000 };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle multiple maps in text (choose first)', () => {
      const schema = z.record(z.string());
      const input = 'First: {"a": "1"} and second: {"b": "2"}';
      const expected = { a: "1" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Complex Map Scenarios', () => {
    it('should handle map with complex nested structure', () => {
      const schema = z.record(z.object({
        config: z.record(z.union([z.string(), z.number(), z.boolean()])),
        items: z.array(z.string()),
        enabled: z.boolean()
      }));
      
      const input = `{
        "service1": {
          "config": {"host": "localhost", "port": 8080, "ssl": true},
          "items": ["item1", "item2"],
          "enabled": true
        },
        "service2": {
          "config": {"host": "remote", "port": 9090, "ssl": false},
          "items": ["item3"],
          "enabled": false
        }
      }`;
      
      const expected = {
        service1: {
          config: { host: "localhost", port: 8080, ssl: true },
          items: ["item1", "item2"],
          enabled: true
        },
        service2: {
          config: { host: "remote", port: 9090, ssl: false },
          items: ["item3"],
          enabled: false
        }
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle map in array', () => {
      const schema = z.array(z.record(z.string()));
      const input = `[
        {"name": "Alice", "role": "admin"},
        {"name": "Bob", "role": "user"}
      ]`;
      const expected = [
        { name: "Alice", role: "admin" },
        { name: "Bob", role: "user" }
      ];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle map with array of maps', () => {
      const schema = z.record(z.array(z.record(z.string())));
      const input = `{
        "users": [
          {"id": "1", "name": "Alice"},
          {"id": "2", "name": "Bob"}
        ],
        "groups": [
          {"id": "10", "name": "Admins"}
        ]
      }`;
      const expected = {
        users: [
          { id: "1", name: "Alice" },
          { id: "2", name: "Bob" }
        ],
        groups: [
          { id: "10", name: "Admins" }
        ]
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });
});