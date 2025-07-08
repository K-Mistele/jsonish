import { test, expect, describe } from 'bun:test';
import { z } from 'zod';
import { parseWithSchema, ValidationError, coerce } from '../src/index.js';

describe('Schema Validation and Type Coercion', () => {
  describe('Basic Schema Validation', () => {
    test('should validate simple object schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean()
      });
      
      const json = '{"name": "John", "age": 30, "active": true}';
      const result = parseWithSchema(json, schema);
      
      expect(result).toEqual({ name: 'John', age: 30, active: true });
    });

    test('should validate array schema', () => {
      const schema = z.array(z.object({
        id: z.number(),
        title: z.string()
      }));
      
      const json = '[{"id": 1, "title": "First"}, {"id": 2, "title": "Second"}]';
      const result = parseWithSchema(json, schema);
      
      expect(result).toEqual([
        { id: 1, title: 'First' },
        { id: 2, title: 'Second' }
      ]);
    });

    test('should validate nested schema', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            age: z.number(),
            email: z.string().email()
          })
        })
      });
      
      const json = '{"user": {"name": "John", "profile": {"age": 30, "email": "john@example.com"}}}';
      const result = parseWithSchema(json, schema);
      
      expect(result.user.name).toBe('John');
      expect(result.user.profile.age).toBe(30);
      expect(result.user.profile.email).toBe('john@example.com');
    });
  });

  describe('Schema Validation Errors', () => {
    test('should throw ValidationError for invalid schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      
      const json = '{"name": "John", "age": "thirty"}';
      
      expect(() => parseWithSchema(json, schema)).toThrow(ValidationError);
    });

    test('should throw ValidationError for missing required fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      
      const json = '{"name": "John"}';
      
      expect(() => parseWithSchema(json, schema)).toThrow(ValidationError);
    });

    test('should provide detailed validation errors', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0).max(150),
        email: z.string().email()
      });
      
      const json = '{"name": 123, "age": -5, "email": "invalid-email"}';
      
      try {
        parseWithSchema(json, schema);
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.validationErrors).toBeDefined();
          expect(error.validationErrors).toHaveLength(3);
        }
      }
    });
  });

  describe('Optional and Default Values', () => {
    test('should handle optional fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
        active: z.boolean().default(true)
      });
      
      const json = '{"name": "John"}';
      const result = parseWithSchema(json, schema);
      
      expect(result.name).toBe('John');
      expect(result.age).toBeUndefined();
      expect(result.active).toBe(true);
    });

    test('should apply default values', () => {
      const schema = z.object({
        name: z.string(),
        role: z.string().default('user'),
        settings: z.object({
          theme: z.string().default('light'),
          notifications: z.boolean().default(true)
        }).default({})
      });
      
      const json = '{"name": "John"}';
      const result = parseWithSchema(json, schema);
      
      expect(result.name).toBe('John');
      expect(result.role).toBe('user');
      expect(result.settings.theme).toBe('light');
      expect(result.settings.notifications).toBe(true);
    });
  });

  describe('Type Coercion', () => {
    test('should coerce string to number', () => {
      const result = coerce.toNumber('42');
      expect(result).toBe(42);
    });

    test('should coerce string to boolean', () => {
      expect(coerce.toBoolean('true')).toBe(true);
      expect(coerce.toBoolean('false')).toBe(false);
      expect(coerce.toBoolean('1')).toBe(true);
      expect(coerce.toBoolean('0')).toBe(false);
    });

    test('should coerce string to array', () => {
      const result = coerce.toArray('["item1", "item2", "item3"]');
      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    test('should handle coercion with schema', () => {
      const schema = z.object({
        id: z.string().transform(coerce.toNumber),
        active: z.string().transform(coerce.toBoolean),
        tags: z.string().transform(coerce.toArray)
      });
      
      const json = '{"id": "123", "active": "true", "tags": "[\\"tag1\\", \\"tag2\\"]"}';
      const result = parseWithSchema(json, schema);
      
      expect(result.id).toBe(123);
      expect(result.active).toBe(true);
      expect(result.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('Union Types', () => {
    test('should handle union types', () => {
      const schema = z.object({
        value: z.union([z.string(), z.number(), z.boolean()])
      });
      
      const testCases = [
        '{"value": "hello"}',
        '{"value": 42}',
        '{"value": true}'
      ];
      
      for (const json of testCases) {
        const result = parseWithSchema(json, schema);
        expect(result.value).toBeDefined();
      }
    });

    test('should handle discriminated unions', () => {
      const schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('user'), name: z.string() }),
        z.object({ type: z.literal('admin'), name: z.string(), permissions: z.array(z.string()) })
      ]);
      
      const userJson = '{"type": "user", "name": "John"}';
      const adminJson = '{"type": "admin", "name": "Admin", "permissions": ["read", "write"]}';
      
      const userResult = parseWithSchema(userJson, schema);
      const adminResult = parseWithSchema(adminJson, schema);
      
      expect(userResult.type).toBe('user');
      expect(adminResult.type).toBe('admin');
      expect(adminResult.permissions).toEqual(['read', 'write']);
    });
  });

  describe('Array Validation', () => {
    test('should validate arrays with constraints', () => {
      const schema = z.array(z.string()).min(1).max(5);
      
      const validJson = '["item1", "item2", "item3"]';
      const result = parseWithSchema(validJson, schema);
      
      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    test('should reject arrays that violate constraints', () => {
      const schema = z.array(z.string()).min(1).max(2);
      
      const invalidJson = '["item1", "item2", "item3"]';
      
      expect(() => parseWithSchema(invalidJson, schema)).toThrow(ValidationError);
    });
  });

  describe('String Validation', () => {
    test('should validate string formats', () => {
      const schema = z.object({
        email: z.string().email(),
        url: z.string().url(),
        uuid: z.string().uuid()
      });
      
      const json = `{
        "email": "test@example.com",
        "url": "https://example.com",
        "uuid": "123e4567-e89b-12d3-a456-426614174000"
      }`;
      
      const result = parseWithSchema(json, schema);
      
      expect(result.email).toBe('test@example.com');
      expect(result.url).toBe('https://example.com');
      expect(result.uuid).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    test('should validate string length constraints', () => {
      const schema = z.object({
        name: z.string().min(2).max(50),
        code: z.string().length(5)
      });
      
      const json = '{"name": "John", "code": "ABC12"}';
      const result = parseWithSchema(json, schema);
      
      expect(result.name).toBe('John');
      expect(result.code).toBe('ABC12');
    });
  });

  describe('Number Validation', () => {
    test('should validate number constraints', () => {
      const schema = z.object({
        age: z.number().min(0).max(150),
        score: z.number().int().positive(),
        rating: z.number().min(1).max(5)
      });
      
      const json = '{"age": 30, "score": 95, "rating": 4.5}';
      const result = parseWithSchema(json, schema);
      
      expect(result.age).toBe(30);
      expect(result.score).toBe(95);
      expect(result.rating).toBe(4.5);
    });

    test('should reject numbers that violate constraints', () => {
      const schema = z.object({
        age: z.number().min(0).max(150)
      });
      
      const invalidJson = '{"age": -5}';
      
      expect(() => parseWithSchema(invalidJson, schema)).toThrow(ValidationError);
    });
  });

  describe('Complex Schema Validation', () => {
    test('should validate complex nested schema', () => {
      const schema = z.object({
        user: z.object({
          id: z.number(),
          name: z.string(),
          contacts: z.array(z.object({
            type: z.enum(['email', 'phone']),
            value: z.string(),
            primary: z.boolean().default(false)
          }))
        }),
        metadata: z.object({
          created: z.string().datetime(),
          tags: z.array(z.string()).optional()
        })
      });
      
      const json = `{
        "user": {
          "id": 1,
          "name": "John Doe",
          "contacts": [
            {"type": "email", "value": "john@example.com", "primary": true},
            {"type": "phone", "value": "+1234567890"}
          ]
        },
        "metadata": {
          "created": "2023-01-01T00:00:00Z",
          "tags": ["user", "active"]
        }
      }`;
      
      const result = parseWithSchema(json, schema);
      
      expect(result.user.id).toBe(1);
      expect(result.user.name).toBe('John Doe');
      expect(result.user.contacts).toHaveLength(2);
      expect(result.user.contacts[0].primary).toBe(true);
      expect(result.user.contacts[1].primary).toBe(false);
      expect(result.metadata.tags).toEqual(['user', 'active']);
    });
  });

  describe('Performance with Schema Validation', () => {
    test('should validate large datasets efficiently', () => {
      const schema = z.array(z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
        active: z.boolean()
      }));
      
      const data = new Array(1000).fill(0).map((_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        active: i % 2 === 0
      }));
      
      const json = JSON.stringify(data);
      
      const start = performance.now();
      const result = parseWithSchema(json, schema);
      const duration = performance.now() - start;
      
      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });
  });

  describe('Error Recovery with Schema', () => {
    test('should provide partial results on validation failure', () => {
      const schema = z.object({
        validField: z.string(),
        invalidField: z.number()
      });
      
      const json = '{"validField": "test", "invalidField": "not-a-number"}';
      
      try {
        parseWithSchema(json, schema);
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.message).toContain('validation');
          expect(error.validationErrors).toBeDefined();
        }
      }
    });
  });
});