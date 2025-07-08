import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { createParser } from '../src/parser';

const parser = createParser();

describe('Unions', () => {
  describe('Simple Unions', () => {
    it('should parse string from string|number union', () => {
      const schema = z.union([z.string(), z.number()]);
      const input = '"hello"';
      const expected = '"hello"';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse number from string|number union', () => {
      const schema = z.union([z.string(), z.number()]);
      const input = '42';
      const expected = 42;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should prefer string over number for ambiguous content', () => {
      const schema = z.union([z.number(), z.string()]);
      const input = '1 cup unsalted butter, room temperature';
      const expected = '1 cup unsalted butter, room temperature';
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse boolean from string|boolean union', () => {
      const schema = z.union([z.string(), z.boolean()]);
      const input = 'true';
      const expected = true;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse null from string|null union', () => {
      const schema = z.union([z.string(), z.null()]);
      const input = 'null';
      const expected = null;
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Object Unions', () => {
    it('should parse first matching object type', () => {
      const fooSchema = z.object({
        hi: z.array(z.string())
      });
      
      const barSchema = z.object({
        foo: z.string()
      });
      
      const schema = z.union([fooSchema, barSchema]);
      const input = '{"hi": ["a", "b"]}';
      const expected = { hi: ["a", "b"] };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should match second object type when first fails', () => {
      const fooSchema = z.object({
        hi: z.array(z.string())
      });
      
      const barSchema = z.object({
        foo: z.string()
      });
      
      const schema = z.union([fooSchema, barSchema]);
      const input = '{"foo": "hello"}';
      const expected = { foo: "hello" };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle union with array variant', () => {
      const fooSchema = z.object({
        hi: z.array(z.string())
      });
      
      const barArraySchema = z.array(z.object({
        foo: z.string()
      }));
      
      const schema = z.union([fooSchema, barArraySchema]);
      const input = '[{"foo": "hello"}]';
      const expected = [{ foo: "hello" }];
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Discriminated Unions', () => {
    it('should parse discriminated union based on action field', () => {
      const catAPickerSchema = z.object({
        cat: z.enum(['A']),
        // other fields would be here
      });
      
      const catBPickerSchema = z.object({
        cat: z.enum(['C', 'D']),
        item: z.number()
      });
      
      const catCPickerSchema = z.object({
        cat: z.enum(['E', 'F', 'G', 'H', 'I']),
        item: z.union([z.number(), z.string(), z.null()]),
        data: z.number().optional()
      });
      
      const schema = z.union([catAPickerSchema, catBPickerSchema, catCPickerSchema]);
      const input = `{
        "cat": "E",
        "item": "28558C",
        "data": null
      }`;
      const expected: z.infer<typeof catCPickerSchema> = {
        cat: "E",
        item: "28558C",
        data: undefined
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should parse discriminated union from markdown', () => {
      const catAPickerSchema = z.object({
        cat: z.enum(['A']),
      });
      
      const catBPickerSchema = z.object({
        cat: z.enum(['C', 'D']),
        item: z.number()
      });
      
      const catCPickerSchema = z.object({
        cat: z.enum(['E', 'F', 'G', 'H', 'I']),
        item: z.union([z.number(), z.string(), z.null()]),
        data: z.number().optional()
      });
      
      const schema = z.union([catAPickerSchema, catBPickerSchema, catCPickerSchema]);
      const input = `\`\`\`json
{
  "cat": "E",
  "item": "28558C",
  "data": null
}
\`\`\``;
      const expected: z.infer<typeof catCPickerSchema> = {
        cat: "E",
        item: "28558C",
        data: undefined
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });
  });

  describe('Complex Union Scenarios', () => {
    it('should handle union with nested objects and arrays', () => {
      const respondToUserSchema = z.object({
        action: z.enum(['RESPOND_TO_USER']),
        sections: z.array(z.object({
          section_title: z.string(),
          type: z.array(z.enum(['CompanyBadge', 'Markdown', 'BarGraph'])),
          content: z.object({
            companyBadge: z.object({
              name: z.string(),
              symbol: z.string(),
              logo_url: z.string()
            }).optional(),
            richText: z.object({
              text: z.string()
            }).optional(),
            barGraph: z.array(z.object({
              name: z.string(),
              expected: z.number(),
              reported: z.number()
            })).optional()
          })
        }))
      });
      
      const askClarificationSchema = z.object({
        action: z.enum(['ASK_CLARIFICATION']),
        question: z.string()
      });
      
      const assistantSchema = z.object({
        action: z.enum(['ETF', 'Stock']),
        instruction: z.string(),
        user_message: z.string()
      });
      
      const schema = z.union([respondToUserSchema, askClarificationSchema, z.array(assistantSchema)]);
      
      const input = `{
        "action": "RESPOND_TO_USER",
        "sections": [
          {
            "section_title": "NVIDIA Corporation (NVDA) Latest Earnings Summary",
            "type": ["CompanyBadge", "Markdown", "BarGraph"],
            "content": {
              "companyBadge": {
                "name": "NVIDIA Corporation",
                "symbol": "NVDA",
                "logo_url": "https://example.com/nvidia-logo.png"
              },
              "richText": {
                "text": "### Key Metrics for the Latest Earnings Report"
              },
              "barGraph": [
                {
                  "name": "Earnings Per Share (EPS)",
                  "expected": 0.64,
                  "reported": 0.68
                }
              ]
            }
          }
        ]
      }`;
      
      const expected: z.infer<typeof respondToUserSchema> = {
        action: "RESPOND_TO_USER",
        sections: [
          {
            section_title: "NVIDIA Corporation (NVDA) Latest Earnings Summary",
            type: ["CompanyBadge", "Markdown", "BarGraph"],
            content: {
              companyBadge: {
                name: "NVIDIA Corporation",
                symbol: "NVDA",
                logo_url: "https://example.com/nvidia-logo.png"
              },
              richText: {
                text: "### Key Metrics for the Latest Earnings Report"
              },
              barGraph: [
                {
                  name: "Earnings Per Share (EPS)",
                  expected: 0.64,
                  reported: 0.68
                }
              ]
            }
          }
        ]
      };
      
      const result = parser.parse(input, schema);
      expect(result).toEqual(expected);
    });

    it('should handle union with validation constraints', () => {
      const phoneSchema = z.object({
        value: z.string().regex(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
      });
      
      const emailSchema = z.object({
        value: z.string().email()
      });
      
      const contactSchema = z.object({
        primary: z.union([phoneSchema, emailSchema])
      });
      
      const phoneInput = '{"primary": {"value": "908-797-8281"}}';
      const phoneExpected = { primary: { value: "908-797-8281" } };
      
      const phoneResult = parser.parse(phoneInput, contactSchema);
      expect(phoneResult).toEqual(phoneExpected);
      
      const emailInput = '{"primary": {"value": "help@boundaryml.com"}}';
      const emailExpected = { primary: { value: "help@boundaryml.com" } };
      
      const emailResult = parser.parse(emailInput, contactSchema);
      expect(emailResult).toEqual(emailExpected);
    });
  });

  describe('Union Type Inference', () => {
    it('should infer correct type based on structure', () => {
      const numberSchema = z.number();
      const stringSchema = z.string();
      const booleanSchema = z.boolean();
      
      const schema = z.union([numberSchema, stringSchema, booleanSchema]);
      
      // Should infer as number
      const numberResult = parser.parse('42', schema);
      expect(typeof numberResult).toBe('number');
      expect(numberResult).toBe(42);
      
      // Should infer as string
      const stringResult = parser.parse('"hello"', schema);
      expect(typeof stringResult).toBe('string');
      expect(stringResult).toBe('"hello"');
      
      // Should infer as boolean
      const booleanResult = parser.parse('true', schema);
      expect(typeof booleanResult).toBe('boolean');
      expect(booleanResult).toBe(true);
    });

    it('should handle union with optional types', () => {
      const schema = z.union([z.string(), z.number(), z.null()]);
      
      const stringResult = parser.parse('"test"', schema);
      expect(stringResult).toBe('"test"');
      
      const numberResult = parser.parse('123', schema);
      expect(numberResult).toBe(123);
      
      const nullResult = parser.parse('null', schema);
      expect(nullResult).toBe(null);
    });

    it('should handle union with array types', () => {
      const schema = z.union([z.array(z.string()), z.array(z.number())]);
      
      const stringArrayResult = parser.parse('["a", "b", "c"]', schema);
      expect(stringArrayResult).toEqual(["a", "b", "c"]);
      
      const numberArrayResult = parser.parse('[1, 2, 3]', schema);
      expect(numberArrayResult).toEqual([1, 2, 3]);
    });
  });

  describe('Union Error Handling', () => {
    it('should handle malformed input gracefully', () => {
      const schema = z.union([z.string(), z.number()]);
      const input = 'malformed{';
      
      // Should not throw and should return something reasonable
      expect(() => parser.parse(input, schema)).not.toThrow();
    });

    it('should handle empty input', () => {
      const schema = z.union([z.string(), z.number(), z.null()]);
      const input = '';
      
      // Should handle empty input gracefully
      expect(() => parser.parse(input, schema)).not.toThrow();
    });

    it('should handle input that matches no union member', () => {
      const schema = z.union([z.number(), z.boolean()]);
      const input = '"this is clearly a string"';
      
      // Should either coerce or handle gracefully
      expect(() => parser.parse(input, schema)).not.toThrow();
    });
  });

  describe('Union with Enums', () => {
    it('should handle union with enum types', () => {
      const categoryASchema = z.enum(['A', 'B']);
      const categoryBSchema = z.enum(['C', 'D']);
      
      const schema = z.union([categoryASchema, categoryBSchema]);
      
      const resultA = parser.parse('A', schema);
      expect(resultA).toBe('A');
      
      const resultC = parser.parse('C', schema);
      expect(resultC).toBe('C');
    });

    it('should handle union with enum in object', () => {
      const typeASchema = z.object({
        type: z.enum(['TypeA']),
        valueA: z.string()
      });
      
      const typeBSchema = z.object({
        type: z.enum(['TypeB']),
        valueB: z.number()
      });
      
      const schema = z.union([typeASchema, typeBSchema]);
      
      const inputA = '{"type": "TypeA", "valueA": "hello"}';
      const expectedA: z.infer<typeof typeASchema> = { type: "TypeA", valueA: "hello" };
      const resultA = parser.parse(inputA, schema);
      expect(resultA).toEqual(expectedA);
      
      const inputB = '{"type": "TypeB", "valueB": 42}';
      const expectedB: z.infer<typeof typeBSchema> = { type: "TypeB", valueB: 42 };
      const resultB = parser.parse(inputB, schema);
      expect(resultB).toEqual(expectedB);
    });
  });
});