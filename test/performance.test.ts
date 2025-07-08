import { test, expect, describe } from 'bun:test';
import { parseJSON, parseJSONish } from '../src/index.js';

describe('Performance Benchmarks', () => {
  describe('Basic Performance', () => {
    test('should parse small JSON objects quickly', () => {
      const json = '{"name": "test", "age": 30, "active": true}';
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        parseJSON(json);
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    test('should parse small JSONish objects quickly', () => {
      const json = '{name: "test", age: 30, active: true,}';
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        parseJSONish(json);
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200); // JSONish may be slightly slower
    });
  });

  describe('Array Performance', () => {
    test('should handle large arrays efficiently', () => {
      const largeArray = new Array(10000).fill(0).map((_, i) => i);
      const json = JSON.stringify(largeArray);
      
      const start = performance.now();
      const result = parseJSON(json);
      const duration = performance.now() - start;
      
      expect(result).toEqual(largeArray);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should handle arrays with objects efficiently', () => {
      const data = new Array(1000).fill(0).map((_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        active: i % 2 === 0
      }));
      const json = JSON.stringify(data);
      
      const start = performance.now();
      const result = parseJSON(json);
      const duration = performance.now() - start;
      
      expect(result).toEqual(data);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });
  });

  describe('Object Performance', () => {
    test('should handle large objects efficiently', () => {
      const largeObject: Record<string, number> = {};
      for (let i = 0; i < 10000; i++) {
        largeObject[`key${i}`] = i;
      }
      const json = JSON.stringify(largeObject);
      
      const start = performance.now();
      const result = parseJSON(json);
      const duration = performance.now() - start;
      
      expect(result).toEqual(largeObject);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should handle nested objects efficiently', () => {
      const nestedData = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  data: new Array(100).fill(0).map((_, i) => ({
                    id: i,
                    value: `item${i}`
                  }))
                }
              }
            }
          }
        }
      };
      const json = JSON.stringify(nestedData);
      
      const start = performance.now();
      const result = parseJSON(json);
      const duration = performance.now() - start;
      
      expect(result).toEqual(nestedData);
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });
  });

  describe('String Performance', () => {
    test('should handle large strings efficiently', () => {
      const largeString = 'a'.repeat(100000);
      const json = JSON.stringify({ message: largeString });
      
      const start = performance.now();
      const result = parseJSON(json);
      const duration = performance.now() - start;
      
      expect(result).toEqual({ message: largeString });
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });

    test('should handle strings with many escape sequences', () => {
      const escapedString = 'line1\\nline2\\tindented\\r\\nline3\\\\backslash\\"quote';
      const json = JSON.stringify({ text: escapedString });
      
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        parseJSON(json);
      }
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(200); // Should complete in under 200ms
    });
  });

  describe('Memory Usage', () => {
    test('should not leak memory during repeated parsing', () => {
      const json = '{"name": "test", "data": [1, 2, 3, 4, 5]}';
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 10000; i++) {
        parseJSON(json);
      }
      
      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be minimal (less than 10MB)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Comparative Performance', () => {
    test('should compare with native JSON.parse for standard JSON', () => {
      const json = JSON.stringify({
        users: new Array(1000).fill(0).map((_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`
        }))
      });
      
      // Test native JSON.parse
      const nativeStart = performance.now();
      const nativeResult = JSON.parse(json);
      const nativeDuration = performance.now() - nativeStart;
      
      // Test our parser
      const customStart = performance.now();
      const customResult = parseJSON(json);
      const customDuration = performance.now() - customStart;
      
      expect(customResult).toEqual(nativeResult);
      
      // Our parser should be within reasonable performance bounds
      // (e.g., no more than 10x slower than native)
      expect(customDuration).toBeLessThan(nativeDuration * 10);
    });

    test('should handle JSONish features that native parser cannot', () => {
      const jsonishInput = `{
        name: "test",        // Comment
        age: 30,
        active: true,        /* Multi-line
                               comment */
        tags: ["tag1", "tag2",],
      }`;
      
      // Native parser should fail
      expect(() => JSON.parse(jsonishInput)).toThrow();
      
      // Our parser should succeed
      const start = performance.now();
      const result = parseJSONish(jsonishInput);
      const duration = performance.now() - start;
      
      expect(result).toEqual({
        name: 'test',
        age: 30,
        active: true,
        tags: ['tag1', 'tag2']
      });
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe('Stress Tests', () => {
    test('should handle deeply nested structures without stack overflow', () => {
      const depth = 1000;
      let json = '';
      
      for (let i = 0; i < depth; i++) {
        json += '{"level": ';
      }
      json += '"deep"';
      for (let i = 0; i < depth; i++) {
        json += '}';
      }
      
      const start = performance.now();
      const result = parseJSON(json);
      const duration = performance.now() - start;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should handle wide objects with many properties', () => {
      const wideObject: Record<string, any> = {};
      for (let i = 0; i < 10000; i++) {
        wideObject[`prop${i}`] = {
          id: i,
          name: `Property ${i}`,
          value: Math.random()
        };
      }
      const json = JSON.stringify(wideObject);
      
      const start = performance.now();
      const result = parseJSON(json);
      const duration = performance.now() - start;
      
      expect(Object.keys(result)).toHaveLength(10000);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });
  });

  describe('Real-world Performance', () => {
    test('should handle typical API response quickly', () => {
      const apiResponse = {
        status: 'success',
        data: {
          users: new Array(100).fill(0).map((_, i) => ({
            id: i,
            username: `user${i}`,
            email: `user${i}@example.com`,
            profile: {
              firstName: `First${i}`,
              lastName: `Last${i}`,
              bio: `This is user ${i}'s bio with some "quotes" and special chars!@#$%`,
              settings: {
                theme: i % 2 === 0 ? 'dark' : 'light',
                notifications: true,
                privacy: 'public'
              }
            },
            posts: new Array(Math.floor(Math.random() * 10)).fill(0).map((_, j) => ({
              id: `${i}-${j}`,
              title: `Post ${j} by user ${i}`,
              content: `This is the content of post ${j}`,
              timestamp: new Date().toISOString(),
              tags: [`tag${j}`, `user${i}`]
            }))
          })),
          pagination: {
            page: 1,
            limit: 100,
            total: 1000,
            hasNext: true,
            hasPrev: false
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      
      const json = JSON.stringify(apiResponse);
      
      const start = performance.now();
      const result = parseJSON(json);
      const duration = performance.now() - start;
      
      expect(result).toEqual(apiResponse);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});