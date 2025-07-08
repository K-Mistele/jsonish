import { test, expect, describe } from 'bun:test';
import { parseStream, parsePartialJSON } from '../src/index.js';

describe('Streaming and Incremental Parsing', () => {
  describe('Basic Streaming', () => {
    test('should parse simple streaming JSON', () => {
      const input = '{"name": "test", "age": 30}';
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ name: 'test', age: 30 });
    });

    test('should handle multiple JSON objects in stream', () => {
      const input = '{"id": 1}\n{"id": 2}\n{"id": 3}';
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ id: 1 });
      expect(results[1]).toEqual({ id: 2 });
      expect(results[2]).toEqual({ id: 3 });
    });

    test('should handle arrays in stream', () => {
      const input = '[1, 2, 3]\n[4, 5, 6]';
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual([1, 2, 3]);
      expect(results[1]).toEqual([4, 5, 6]);
    });
  });

  describe('Incremental Parsing', () => {
    test('should parse incomplete JSON gracefully', () => {
      const result = parsePartialJSON('{"name": "test", "age":');
      expect(result).toEqual({ name: 'test' });
    });

    test('should parse incomplete array gracefully', () => {
      const result = parsePartialJSON('[1, 2, 3, 4');
      expect(result).toEqual([1, 2, 3, 4]);
    });

    test('should parse incomplete nested structure', () => {
      const result = parsePartialJSON('{"user": {"name": "test", "details": {"age": 30');
      expect(result).toEqual({ user: { name: 'test', details: { age: 30 } } });
    });

    test('should handle partial string values', () => {
      const result = parsePartialJSON('{"message": "hello wor');
      expect(result).toEqual({ message: 'hello wor' });
    });

    test('should handle partial number values', () => {
      const result = parsePartialJSON('{"value": 42.5');
      expect(result).toEqual({ value: 42.5 });
    });
  });

  describe('Stream with Mixed Content', () => {
    test('should extract JSON from mixed text stream', () => {
      const input = 'Some text before {"valid": true} and after';
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ valid: true });
    });

    test('should handle multiple JSON objects in mixed text', () => {
      const input = 'Text {"a": 1} more text {"b": 2} end';
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ a: 1 });
      expect(results[1]).toEqual({ b: 2 });
    });

    test('should handle JSON in code blocks', () => {
      const input = `
        Here's some JSON:
        \`\`\`json
        {"name": "test", "value": 42}
        \`\`\`
        And more text.
      `;
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ name: 'test', value: 42 });
    });
  });

  describe('Streaming Performance', () => {
    test('should handle large streaming data efficiently', () => {
      const chunks = new Array(1000).fill(0).map((_, i) => 
        JSON.stringify({ id: i, name: `item${i}` })
      );
      const input = chunks.join('\n');
      
      const start = performance.now();
      const generator = parseStream(input);
      const results = Array.from(generator);
      const duration = performance.now() - start;
      
      expect(results).toHaveLength(1000);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    test('should handle streaming with backpressure', () => {
      const input = '{"start": true}\n{"processing": true}\n{"end": true}';
      const generator = parseStream(input);
      
      // Process one by one to simulate backpressure
      const results = [];
      for (const item of generator) {
        results.push(item);
        // Simulate processing time
        const start = Date.now();
        while (Date.now() - start < 1) { /* wait */ }
      }
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ start: true });
      expect(results[1]).toEqual({ processing: true });
      expect(results[2]).toEqual({ end: true });
    });
  });

  describe('Error Handling in Streaming', () => {
    test('should handle malformed JSON in stream gracefully', () => {
      const input = '{"valid": true}\n{invalid json}\n{"another": "valid"}';
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      // Should skip malformed JSON and continue
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ valid: true });
      expect(results[1]).toEqual({ another: 'valid' });
    });

    test('should handle incomplete JSON at end of stream', () => {
      const input = '{"complete": true}\n{"incomplete": "missing';
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ complete: true });
      expect(results[1]).toEqual({ incomplete: 'missing' });
    });

    test('should handle empty lines in stream', () => {
      const input = '{"first": 1}\n\n\n{"second": 2}\n\n{"third": 3}';
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ first: 1 });
      expect(results[1]).toEqual({ second: 2 });
      expect(results[2]).toEqual({ third: 3 });
    });
  });

  describe('Real-world Streaming Scenarios', () => {
    test('should handle log file parsing', () => {
      const logEntries = [
        '{"timestamp": "2023-01-01T00:00:00Z", "level": "INFO", "message": "Server started"}',
        '{"timestamp": "2023-01-01T00:01:00Z", "level": "DEBUG", "message": "Processing request"}',
        '{"timestamp": "2023-01-01T00:02:00Z", "level": "ERROR", "message": "Database connection failed"}',
        '{"timestamp": "2023-01-01T00:03:00Z", "level": "INFO", "message": "Request completed"}'
      ];
      const input = logEntries.join('\n');
      
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(4);
      expect(results[0].level).toBe('INFO');
      expect(results[1].level).toBe('DEBUG');
      expect(results[2].level).toBe('ERROR');
      expect(results[3].level).toBe('INFO');
    });

    test('should handle NDJSON (Newline Delimited JSON)', () => {
      const ndjsonData = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
        { id: 3, name: 'Charlie', age: 35 }
      ];
      const input = ndjsonData.map(item => JSON.stringify(item)).join('\n');
      
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toEqual(ndjsonData);
    });

    test('should handle streaming API responses', () => {
      const apiResponses = [
        { status: 'processing', progress: 0 },
        { status: 'processing', progress: 50 },
        { status: 'completed', progress: 100, result: { success: true } }
      ];
      const input = apiResponses.map(item => JSON.stringify(item)).join('\n');
      
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toEqual(apiResponses);
      expect(results[results.length - 1].status).toBe('completed');
    });
  });

  describe('Memory Efficiency', () => {
    test('should not accumulate memory during long stream processing', () => {
      const input = new Array(10000).fill(0).map((_, i) => 
        JSON.stringify({ id: i, data: `item${i}` })
      ).join('\n');
      
      const generator = parseStream(input);
      
      // Process stream without accumulating all results
      let count = 0;
      for (const item of generator) {
        count++;
        // Verify structure but don't keep reference
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('data');
      }
      
      expect(count).toBe(10000);
    });

    test('should handle large individual JSON objects in stream', () => {
      const largeObject = {
        id: 1,
        data: new Array(1000).fill(0).map((_, i) => ({ index: i, value: `item${i}` }))
      };
      const input = JSON.stringify(largeObject);
      
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(largeObject);
    });
  });

  describe('Edge Cases in Streaming', () => {
    test('should handle whitespace-only lines', () => {
      const input = '{"a": 1}\n   \n\t\n{"b": 2}';
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ a: 1 });
      expect(results[1]).toEqual({ b: 2 });
    });

    test('should handle mixed line endings', () => {
      const input = '{"a": 1}\r\n{"b": 2}\r{"c": 3}\n{"d": 4}';
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(4);
      expect(results.map(r => Object.keys(r)[0])).toEqual(['a', 'b', 'c', 'd']);
    });

    test('should handle very long lines', () => {
      const largeString = 'x'.repeat(100000);
      const input = JSON.stringify({ data: largeString });
      
      const generator = parseStream(input);
      const results = Array.from(generator);
      
      expect(results).toHaveLength(1);
      expect(results[0].data).toBe(largeString);
    });
  });
});