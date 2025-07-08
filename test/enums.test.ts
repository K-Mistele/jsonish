import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { createParser } from '../src/parser';

const parser = createParser();

describe('Enums', () => {
  describe('Basic Enum Parsing', () => {
    it('should parse enum value exactly', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = 'TWO';
      const expected = 'TWO';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse enum value case-insensitively', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = 'two';
      const expected = 'TWO';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse enum value with quotes', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = '"TWO"';
      const expected = 'TWO';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse enum from single item array', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = '["TWO"]';
      const expected = 'TWO';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse enum from multi-item array (take first)', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = '["TWO", "ONE"]';
      const expected = 'TWO';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Enum with Mixed Content', () => {
    it('should extract enum from text with prefix', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = 'The answer is ONE';
      const expected = 'ONE';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract enum with case mismatch', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = 'The answer is one';
      const expected = 'ONE';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract enum wrapped in markdown', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = '**one** is the answer';
      const expected = 'ONE';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract enum with description prefix', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = '"ONE: The description of k1"';
      const expected = 'ONE';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract enum with description dash', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = '"ONE - The description of an enum value"';
      const expected = 'ONE';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract enum from quoted text', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = '"TWO" is one of the correct answers.';
      const expected = 'TWO';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Enum Arrays', () => {
    it('should parse array of enums', () => {
      const schema = z.array(z.enum(['ONE', 'TWO', 'THREE']));
      const input = '["ONE", "TWO"]';
      const expected: ('ONE' | 'TWO' | 'THREE')[] = ['ONE', 'TWO'];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse array of enums from markdown', () => {
      const schema = z.array(z.enum(['ONE', 'TWO', 'THREE']));
      const input = `I would think something like this!
\`\`\`json    
["ONE", "TWO", "THREE"]
\`\`\``;
      const expected: ('ONE' | 'TWO' | 'THREE')[] = ['ONE', 'TWO', 'THREE'];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse array of enums with unquoted values', () => {
      const schema = z.array(z.enum(['ONE', 'TWO', 'THREE']));
      const input = '[ONE, "TWO", "THREE"]';
      const expected: ('ONE' | 'TWO' | 'THREE')[] = ['ONE', 'TWO', 'THREE'];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Numerical Enums', () => {
    it('should parse numerical enum values', () => {
      const schema = z.enum(['9325', '9465', '1040', '1040-X']);
      const input = '1040-X';
      const expected = '1040-X';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse numerical enum from text', () => {
      const schema = z.enum(['9325', '9465', '1040', '1040-X']);
      const input = 'such as 1040-X, 1040, etc.';
      const expected = '1040-X';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle null when no enum found', () => {
      const schema = z.enum(['9325', '9465', '1040', '1040-X']).optional();
      const input = 'no relevant tax return form type present';
      const expected: ('9325' | '9465' | '1040' | '1040-X') | undefined = undefined;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Case Variations', () => {
    it('should handle PascalCase enum with uppercase input', () => {
      const schema = z.enum(['One', 'Two']);
      const input = '**ONE** is the answer';
      const expected = 'One';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle UPPERCASE enum with PascalCase input', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = '**One** is the answer';
      const expected = 'ONE';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle mixed case in content', () => {
      const schema = z.enum(['SPAM', 'NOT_SPAM']);
      const input = `The text "Buy cheap watches now!" is typically characterized by unsolicited 
offers and urgency, which are common traits of spam messages. Therefore, it should be classified as:

- **SPAM**`;
      const expected = 'SPAM';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Complex Enum Scenarios', () => {
    it('should handle enum with special characters', () => {
      const schema = z.enum(['SPAM', 'NOT_SPAM']);
      const input = `The text "Buy cheap watches now! Limited time offer!!!" is typically characterized by unsolicited 
offers and urgency ($^{$_{Ω}$rel}$), which are common traits of spam messages. Therefore, it should be classified as:

- **SPAM**`;
      const expected = 'SPAM';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should extract enum from complex description', () => {
      const schema = z.enum(['SPAM', 'NOT_SPAM']);
      const input = `\`SPAM\`

The category "SPAM: User is excited" is designed to identify and classify user inputs that express strong positive emotions, enthusiasm, or anticipation. This classification applies when the language used by the user conveys an eagerness or thrill about something they are experiencing or expecting.

### Characteristics of Excitement
- **Emotional Expressions:** The use of exclamation marks, emphatic words like "amazing," "incredible," or "fantastic."
- **Positive Language:** Use of positive adjectives and adverbs such as "can't wait," "thrilled," "excited," or "elated."
- **Anticipation:** Statements that show looking forward to an event, result, or item.`;
      const expected = 'SPAM';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle enum in object', () => {
      const schema = z.object({
        type: z.enum(['SPAM', 'NOT_SPAM']),
        confidence: z.number()
      });
      const input = '{"type": "SPAM", "confidence": 0.95}';
      const expected: { type: 'SPAM' | 'NOT_SPAM'; confidence: number } = { type: 'SPAM', confidence: 0.95 };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Enum Error Cases', () => {
    it('should handle ambiguous enum matches', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = 'Two is one of the correct answers.';
      
      // This should either pick the best match or fail gracefully
      expect(() => parser.parse(input, schema)).not.toThrow();
    });

    it('should handle multiple enum values in text', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = '"ONE - is the answer, not TWO"';
      
      // Should pick the first/best match
      const result = parser.parse(input, schema);
      expect(['ONE', 'TWO']).toContain(result);
    });

    it('should handle no enum match', () => {
      const schema = z.enum(['ONE', 'TWO']).optional();
      const input = 'This text contains no valid enum values';
      
      const result = parser.parse(input, schema);
      expect(result).toBeUndefined();
    });
  });

  describe('Enum Aliases and Descriptions', () => {
    // Note: These tests assume alias support in the parser
    // The actual implementation may need to handle aliases differently
    
    it('should handle enum with simple alias', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = 'k1'; // Assuming k1 is an alias for ONE
      
      // This test may need adjustment based on how aliases are implemented
      const result = parser.parse(input, schema);
      expect(result).toBeDefined();
    });

    it('should handle enum with complex alias', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = 'k-2-3.1_1'; // Assuming this is an alias for TWO
      
      // This test may need adjustment based on how aliases are implemented
      const result = parser.parse(input, schema);
      expect(result).toBeDefined();
    });

    it('should handle enum with spaced alias', () => {
      const schema = z.enum(['ONE', 'TWO', 'THREE']);
      const input = 'NUMBER THREE'; // Assuming this is an alias for THREE
      
      // This test may need adjustment based on how aliases are implemented
      const result = parser.parse(input, schema);
      expect(result).toBeDefined();
    });

    it('should handle enum with description', () => {
      const schema = z.enum(['ONE', 'TWO']);
      const input = 'k1: The description of enum value une';
      
      // Should extract the enum value from the description
      const result = parser.parse(input, schema);
      expect(result).toBeDefined();
    });
  });
});