import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { createParser } from '../src/parser';

const parser = createParser();

describe('Objects', () => {
  describe('Basic Object Parsing', () => {
    it('should parse a simple object', () => {
      const schema = z.object({
        key: z.string()
      });
      const input = '{"key": "value"}';
      const expected = { key: "value" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse object with multiple fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean()
      });
      const input = '{"name": "Alice", "age": 30, "active": true}';
      const expected = { name: "Alice", age: 30, active: true };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse object with array field', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string())
      });
      const input = '{"name": "Alice", "tags": ["developer", "manager"]}';
      const expected = { name: "Alice", tags: ["developer", "manager"] };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Optional Fields', () => {
    it('should handle object with optional field present', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().optional()
      });
      const input = '{"name": "Alice", "email": "alice@example.com"}';
      const expected = { name: "Alice", email: "alice@example.com" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle object with optional field missing', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().optional()
      });
      const input = '{"name": "Alice"}';
      const expected = { name: "Alice" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle object with nullable field', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().nullable()
      });
      const input = '{"name": "Alice", "email": null}';
      const expected = { name: "Alice", email: null };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle mix of required and optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        nullable: z.string().nullable()
      });
      const input = '{"required": "present", "nullable": null}';
      const expected = { required: "present", nullable: null };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Nested Objects', () => {
    it('should parse object with nested object', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number()
        }),
        active: z.boolean()
      });
      const input = '{"user": {"name": "Alice", "age": 30}, "active": true}';
      const expected = { 
        user: { name: "Alice", age: 30 }, 
        active: true 
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse deeply nested objects', () => {
      const schema = z.object({
        company: z.object({
          name: z.string(),
          address: z.object({
            street: z.string(),
            city: z.string(),
            country: z.string()
          })
        })
      });
      const input = `{
        "company": {
          "name": "Tech Corp",
          "address": {
            "street": "123 Tech St",
            "city": "San Francisco",
            "country": "USA"
          }
        }
      }`;
      const expected = {
        company: {
          name: "Tech Corp",
          address: {
            street: "123 Tech St",
            city: "San Francisco",
            country: "USA"
          }
        }
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse object with nested arrays of objects', () => {
      const schema = z.object({
        users: z.array(z.object({
          name: z.string(),
          permissions: z.array(z.string())
        }))
      });
      const input = `{
        "users": [
          {"name": "Alice", "permissions": ["read", "write"]},
          {"name": "Bob", "permissions": ["read"]}
        ]
      }`;
      const expected = {
        users: [
          { name: "Alice", permissions: ["read", "write"] },
          { name: "Bob", permissions: ["read"] }
        ]
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Malformed Object Handling', () => {
    it('should handle object with trailing comma', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      const input = '{"name": "Alice", "age": 30,}';
      const expected = { name: "Alice", age: 30 };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle object with unquoted keys', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      const input = '{name: "Alice", age: 30}';
      const expected = { name: "Alice", age: 30 };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle object with unquoted string values', () => {
      const schema = z.object({
        name: z.string(),
        status: z.string()
      });
      const input = '{name: Alice, status: active}';
      const expected = { name: "Alice", status: "active" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle incomplete object', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional()
      });
      const input = '{"name": "Alice"';
      const expected = { name: "Alice" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle object with comments', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      const input = `{
        // User information
        "name": "Alice",
        "age": 30 /* years old */
      }`;
      const expected = { name: "Alice", age: 30 };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Single Field Coercion', () => {
    it('should coerce single string to object with string field', () => {
      const schema = z.object({
        value: z.string()
      });
      const input = '"hello"';
      const expected = { value: "hello" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should coerce single number to object with number field', () => {
      const schema = z.object({
        count: z.number()
      });
      const input = '42';
      const expected = { count: 42 };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should coerce single boolean to object with boolean field', () => {
      const schema = z.object({
        active: z.boolean()
      });
      const input = 'true';
      const expected = { active: true };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Objects from Mixed Content', () => {
    it('should extract object from text with prefix', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      const input = 'The user data is: {"name": "Alice", "age": 30}';
      const expected = { name: "Alice", age: 30 };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract object from markdown code block', () => {
      const schema = z.object({
        title: z.string(),
        author: z.string()
      });
      const input = `
        Here's the book info:
        \`\`\`json
        {
          "title": "The Great Gatsby",
          "author": "F. Scott Fitzgerald"
        }
        \`\`\`
      `;
      const expected = { title: "The Great Gatsby", author: "F. Scott Fitzgerald" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle multiple objects in text (choose first)', () => {
      const schema = z.object({
        name: z.string()
      });
      const input = 'First: {"name": "Alice"} and second: {"name": "Bob"}';
      const expected = { name: "Alice" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Recursive Objects', () => {
    it('should parse recursive object structure', () => {
      type TreeNode = {
        value: string;
        children?: TreeNode[];
      };
      
      const schema: z.ZodSchema<TreeNode> = z.object({
        value: z.string(),
        children: z.array(z.lazy(() => schema)).optional()
      });
      
      const input = `{
        "value": "root",
        "children": [
          {
            "value": "child1",
            "children": [
              {"value": "grandchild1"},
              {"value": "grandchild2"}
            ]
          },
          {"value": "child2"}
        ]
      }`;
      
      const expected = {
        value: "root",
        children: [
          {
            value: "child1",
            children: [
              { value: "grandchild1" },
              { value: "grandchild2" }
            ]
          },
          { value: "child2" }
        ]
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle self-referencing objects', () => {
      type Person = {
        name: string;
        friend?: Person;
      };
      
      const schema: z.ZodSchema<Person> = z.object({
        name: z.string(),
        friend: z.lazy(() => schema).optional()
      });
      
      const input = `{
        "name": "Alice",
        "friend": {
          "name": "Bob",
          "friend": {
            "name": "Charlie"
          }
        }
      }`;
      
      const expected = {
        name: "Alice",
        friend: {
          name: "Bob",
          friend: {
            name: "Charlie"
          }
        }
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should parse a user profile object', () => {
      const schema = z.object({
        id: z.number(),
        username: z.string(),
        email: z.string(),
        profile: z.object({
          firstName: z.string(),
          lastName: z.string(),
          bio: z.string().optional(),
          avatar: z.string().optional()
        }),
        preferences: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean(),
          language: z.string()
        }),
        roles: z.array(z.string()),
        lastLogin: z.string().nullable()
      });
      
      const input = `{
        "id": 123,
        "username": "alice_dev",
        "email": "alice@example.com",
        "profile": {
          "firstName": "Alice",
          "lastName": "Johnson",
          "bio": "Full-stack developer"
        },
        "preferences": {
          "theme": "dark",
          "notifications": true,
          "language": "en"
        },
        "roles": ["user", "developer"],
        "lastLogin": "2023-12-01T10:30:00Z"
      }`;
      
      const expected = {
        id: 123,
        username: "alice_dev",
        email: "alice@example.com",
        profile: {
          firstName: "Alice",
          lastName: "Johnson",
          bio: "Full-stack developer"
        },
        preferences: {
          theme: "dark" as const,
          notifications: true,
          language: "en"
        },
        roles: ["user", "developer"],
        lastLogin: "2023-12-01T10:30:00Z"
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });
});