import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { createParser } from '../src/parser'

const parser = createParser()

describe('Basic Types', () => {
    describe('String Parsing', () => {
        it('should parse a simple string', () => {
            const schema = z.string()
            const input = 'hello'
            const expected = 'hello'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse a quoted string', () => {
            const schema = z.string()
            const input = '"hello"'
            const expected = '"hello"'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse a string from an object when expecting string', () => {
            const schema = z.string()
            const input = '{"hi": "hello"}'
            const expected = '{"hi": "hello"}'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse a string from mixed content', () => {
            const schema = z.string()
            const input = 'The output is: {"hello": "world"}'
            const expected = 'The output is: {"hello": "world"}'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should handle strings with escaped quotes', () => {
            const schema = z.string()
            const input = '"hello \\"world\\""'
            const expected = '"hello \\"world\\""'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should handle incomplete quoted string', () => {
            const schema = z.string()
            const input = '"hello'
            const expected = '"hello'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should handle prefixed incomplete string', () => {
            const schema = z.string()
            const input = 'prefix "hello'
            const expected = 'prefix "hello'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })
    })

    describe('Number Parsing', () => {
        it('should parse a simple integer', () => {
            const schema = z.number()
            const input = '12111'
            const expected = 12111

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse a comma-separated integer', () => {
            const schema = z.number()
            const input = '12,111'
            const expected = 12111

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse a float', () => {
            const schema = z.number()
            const input = '12111.123'
            const expected = 12111.123

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse a comma-separated float (US format)', () => {
            const schema = z.number()
            const input = '12,111.123'
            const expected = 12111.123

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse a float with trailing dot', () => {
            const schema = z.number()
            const input = '12.11.'
            const expected = 12.11

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse a fraction as a float', () => {
            const schema = z.number()
            const input = '1/5'
            const expected = 0.2

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse currency-like numbers', () => {
            const schema = z.number()
            const input = '$1,234.56'
            const expected = 1234.56

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse numbers from strings containing text', () => {
            const schema = z.number()
            const input = '1 cup unsalted butter, room temperature'
            const expected = 1.0

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })
    })

    describe('Boolean Parsing', () => {
        it('should parse true', () => {
            const schema = z.boolean()
            const input = 'true'
            const expected = true

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse false', () => {
            const schema = z.boolean()
            const input = 'false'
            const expected = false

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse True (capitalized)', () => {
            const schema = z.boolean()
            const input = 'True'
            const expected = true

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse False (capitalized)', () => {
            const schema = z.boolean()
            const input = 'False'
            const expected = false

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should extract boolean from text', () => {
            const schema = z.boolean()
            const input = 'The answer is true'
            const expected = true

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should handle case-insensitive boolean in text', () => {
            const schema = z.boolean()
            const input = 'The answer is True'
            const expected = true

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should extract boolean from markdown text', () => {
            const schema = z.boolean()
            const input = 'The tax return you provided has section for dependents.\n\nAnswer: **True**'
            const expected = true

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should extract boolean followed by explanation', () => {
            const schema = z.boolean()
            const input =
                'False.\\n\\nThe statement "2 + 2 = 5" is mathematically incorrect. The correct sum of 2 + 2 is 4, not 5.'
            const expected = false

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should extract boolean array from text', () => {
            const schema = z.array(z.boolean())
            const input = 'The answer is true'
            const expected = [true]

            const result = parser.parse(input, schema)
            expect(result).toEqual(expected)
        })

        it('should extract boolean array with mismatched case', () => {
            const schema = z.array(z.boolean())
            const input = 'The answer is True'
            const expected = [true]

            const result = parser.parse(input, schema)
            expect(result).toEqual(expected)
        })

        it('should fail on ambiguous boolean', () => {
            const schema = z.boolean()
            const input = 'The answer is true or false'

            expect(() => parser.parse(input, schema)).toThrow()
        })

        it('should fail on elaborate ambiguous boolean', () => {
            const schema = z.boolean()
            const input =
                'False. The statement "2 + 2 = 5" is not accurate according to basic arithmetic. In standard arithmetic, the sum of 2 and 2 is equal to 4, not 5. Therefore, the statement does not hold true.'

            expect(() => parser.parse(input, schema)).toThrow()
        })
    })

    describe('Null Parsing', () => {
        it('should parse null', () => {
            const schema = z.null()
            const input = 'null'
            const expected = null

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should parse null for optional string', () => {
            const schema = z.string().nullable()
            const input = 'null'
            const expected = null

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should treat "Null" as string when targeting optional string', () => {
            const schema = z.string().nullable()
            const input = 'Null'
            const expected = 'Null'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should treat "None" as string when targeting optional string', () => {
            const schema = z.string().nullable()
            const input = 'None'
            const expected = 'None'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })
    })

    describe('Array Parsing', () => {
        it('should parse basic integer array', () => {
            const schema = z.array(z.number())
            const input = '[1, 2, 3]'
            const expected = [1, 2, 3]

            const result = parser.parse(input, schema)
            expect(result).toEqual(expected)
        })

        it('should coerce array elements to strings', () => {
            const schema = z.array(z.string())
            const input = '[1, 2, 3]'
            const expected = ['1', '2', '3']

            const result = parser.parse(input, schema)
            expect(result).toEqual(expected)
        })

        it('should coerce array elements to floats', () => {
            const schema = z.array(z.number())
            const input = '[1, 2, 3]'
            const expected = [1, 2, 3]

            const result = parser.parse(input, schema)
            expect(result).toEqual(expected)
        })

        it('should handle arrays with trailing comma', () => {
            const schema = z.array(z.number())
            const input = '[1, 2, 3,]'
            const expected = [1, 2, 3]

            const result = parser.parse(input, schema)
            expect(result).toEqual(expected)
        })

        it('should handle arrays with trailing comma (string coercion)', () => {
            const schema = z.array(z.string())
            const input = '[1, 2, 3,]'
            const expected = ['1', '2', '3']

            const result = parser.parse(input, schema)
            expect(result).toEqual(expected)
        })

        it('should handle incomplete arrays', () => {
            const schema = z.array(z.number())
            const input = '[1, 2, 3'
            const expected = [1, 2, 3]

            const result = parser.parse(input, schema)
            expect(result).toEqual(expected)
        })
    })

    describe('Object Parsing', () => {
        const TestSchema = z.object({
            key: z.string()
        })

        const NestedTestSchema = z.object({
            key: z.array(z.number())
        })

        const FooSchema = z.object({
            key: z.string()
        })

        const ComplexTestSchema = z.object({
            key: z.string(),
            array: z.array(z.number()),
            object: FooSchema
        })

        it('should parse basic object', () => {
            const input = '{"key": "value"}'
            const expected = { key: 'value' }

            const result = parser.parse(input, TestSchema)
            expect(result).toEqual(expected)
        })

        it('should parse nested array in object', () => {
            const input = '{"key": [1, 2, 3]}'
            const expected = { key: [1, 2, 3] }

            const result = parser.parse(input, NestedTestSchema)
            expect(result).toEqual(expected)
        })

        it('should parse object with whitespace', () => {
            const input = ' { "key" : [ 1 , 2 , 3 ] } '
            const expected = { key: [1, 2, 3] }

            const result = parser.parse(input, NestedTestSchema)
            expect(result).toEqual(expected)
        })

        it('should parse object with prefix and suffix', () => {
            const input = 'prefix { "key" : [ 1 , 2 , 3 ] } suffix'
            const expected = { key: [1, 2, 3] }

            const result = parser.parse(input, NestedTestSchema)
            expect(result).toEqual(expected)
        })

        it('should parse first of multiple top-level objects', () => {
            const input = '{"key": "value1"} {"key": "value2"}'
            const expected = { key: 'value1' }

            const result = parser.parse(input, TestSchema)
            expect(result).toEqual(expected)
        })

        it('should parse multiple top-level objects as array', () => {
            const input = '{"key": "value1"} {"key": "value2"}'
            const expected = [{ key: 'value1' }, { key: 'value2' }]

            const result = parser.parse(input, z.array(TestSchema))
            expect(result).toEqual(expected)
        })

        it('should parse multiple objects with text between', () => {
            const input = 'prefix {"key": "value1"} some random text {"key": "value2"} suffix'
            const expected = { key: 'value1' }

            const result = parser.parse(input, TestSchema)
            expect(result).toEqual(expected)
        })

        it('should parse multiple objects with text as array', () => {
            const input = 'prefix {"key": "value1"} some random text {"key": "value2"} suffix'
            const expected = [{ key: 'value1' }, { key: 'value2' }]

            const result = parser.parse(input, z.array(TestSchema))
            expect(result).toEqual(expected)
        })

        it('should handle object with trailing comma', () => {
            const input = '{"key": "value",}'
            const expected = { key: 'value' }

            const result = parser.parse(input, TestSchema)
            expect(result).toEqual(expected)
        })

        it('should handle object with incomplete array', () => {
            const input = '{"key": [1, 2, 3'
            const expected = { key: [1, 2, 3] }

            const result = parser.parse(input, NestedTestSchema)
            expect(result).toEqual(expected)
        })

        it('should handle object with incomplete string', () => {
            const input = '{"key": "value'
            const expected = { key: 'value' }

            const result = parser.parse(input, TestSchema)
            expect(result).toEqual(expected)
        })

        it('should parse large nested object', () => {
            const input = '{"key": "value", "array": [1, 2, 3], "object": {"key": "value"}}'
            const expected = {
                key: 'value',
                array: [1, 2, 3],
                object: { key: 'value' }
            }

            const result = parser.parse(input, ComplexTestSchema)
            expect(result).toEqual(expected)
        })

        it('should handle object with unquoted keys', () => {
            const input = `{
        key: "value",
        array: [1, 2, 3, 'some string'],
        object: {
          key: "value"
        }
      }`
            const expected = {
                key: 'value',
                array: [1, 2, 3],
                object: { key: 'value' }
            }

            const ComplexWithStringArraySchema = z.object({
                key: z.string(),
                array: z.array(z.union([z.number(), z.string()])),
                object: FooSchema
            })

            const result = parser.parse(input, ComplexWithStringArraySchema)
            expect(result).toEqual({
                key: 'value',
                array: [1, 2, 3, 'some string'],
                object: { key: 'value' }
            })
        })

        it('should handle unquoted values with spaces', () => {
            const input = `{
        key: value with space,
        array: [1, 2, 3],
        object: {
          key: value
        }
      }`
            const expected = {
                key: 'value with space',
                array: [1, 2, 3],
                object: { key: 'value' }
            }

            const result = parser.parse(input, ComplexTestSchema)
            expect(result).toEqual(expected)
        })

        it('should handle multiline unquoted values', () => {
            const input = `{
        key: "test a long
thing with new

lines",
        array: [1, 2, 3],
        object: {
          key: value
        }
      }`
            const expected = {
                key: 'test a long\nthing with new\n\nlines',
                array: [1, 2, 3],
                object: { key: 'value' }
            }

            const result = parser.parse(input, ComplexTestSchema)
            expect(result).toEqual(expected)
        })

        it('should preserve whitespace in keys when parsing as string', () => {
            const schema = z.string()
            const input = '{" answer ": {" content ": 78.54}}'
            const expected = '{" answer ": {" content ": 78.54}}'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should handle whitespace in keys for class parsing', () => {
            const AnswerSchema = z.object({
                content: z.number()
            })

            const TestWithAnswerSchema = z.object({
                answer: AnswerSchema
            })

            const input = '{" answer ": {" content ": 78.54}}'
            const expected = { answer: { content: 78.54 } }

            const result = parser.parse(input, TestWithAnswerSchema)
            expect(result).toEqual(expected)
        })
    })

    describe('Markdown Extraction', () => {
        const ComplexTestSchema = z.object({
            key: z.string(),
            array: z.array(z.number()),
            object: z.object({
                key: z.string()
            })
        })

        it('should extract JSON from markdown code block', () => {
            const input = `
  some text
  \`\`\`json
  {
    "key": "value",
    "array": [1, 2, 3],
    "object": {
      "key": "value"
    }
  }
  \`\`\`
  `
            const expected = {
                key: 'value',
                array: [1, 2, 3],
                object: { key: 'value' }
            }

            const result = parser.parse(input, ComplexTestSchema)
            expect(result).toEqual(expected)
        })

        it('should extract first JSON block when multiple exist', () => {
            const input = `
  some text
  \`\`\`json
  {
    "key": "value",
    "array": [1, 2, 3],
    "object": {
      "key": "value"
    }
  }
  \`\`\`


  \`\`\`json
  ["1", "2"]
  \`\`\`
  `
            const expected = {
                key: 'value',
                array: [1, 2, 3],
                object: { key: 'value' }
            }

            const result = parser.parse(input, ComplexTestSchema)
            expect(result).toEqual(expected)
        })

        it('should extract specific type from multiple blocks', () => {
            const input = `
  some text
  \`\`\`json
  {
    "key": "value",
    "array": [1, 2, 3],
    "object": {
      "key": "value"
    }
  }
  \`\`\`


  \`\`\`json
  ["1", "2"]
  \`\`\`
  `
            const expected = [1, 2]

            const result = parser.parse(input, z.array(z.number()))
            expect(result).toEqual(expected)
        })

        it('should handle malformed JSON in markdown', () => {
            const input = `
  some text
  \`\`\`json
  {
    "key": "value",
    "array": [1, 2, 3,],
    "object": {
      "key": "value"
    }
  }
  \`\`\`
  `
            const expected = {
                key: 'value',
                array: [1, 2, 3],
                object: { key: 'value' }
            }

            const result = parser.parse(input, ComplexTestSchema)
            expect(result).toEqual(expected)
        })

        it('should handle markdown without quotes', () => {
            const TestBoolStringSchema = z.object({
                my_field_0: z.boolean(),
                my_field_1: z.string()
            })

            const input = `
  {
    "my_field_0": true,
    "my_field_1": **First fragment, Another fragment**

Frag 2, frag 3. Frag 4, Frag 5, Frag 5.

Frag 6, the rest, of the sentence. Then i would quote something "like this" or this.

Then would add a summary of sorts.
  }
  `
            const expected = {
                my_field_0: true,
                my_field_1:
                    '**First fragment, Another fragment**\n\nFrag 2, frag 3. Frag 4, Frag 5, Frag 5.\n\nFrag 6, the rest, of the sentence. Then i would quote something "like this" or this.\n\nThen would add a summary of sorts.'
            }

            const result = parser.parse(input, TestBoolStringSchema)
            expect(result).toEqual(expected)
        })
    })

    describe('Complex Parsing Scenarios', () => {
        it('should handle localization array', () => {
            const LocalizationSchema = z.object({
                id: z.string(),
                English: z.string(),
                Portuguese: z.string()
            })

            const input = `
To effectively localize these strings for a Portuguese-speaking audience, I will focus on maintaining the original tone and meaning while ensuring that the translations sound natural and culturally appropriate. For the game title "Arcadian Atlas," I will keep it unchanged as it is a proper noun and likely a branded term within the game. For the other strings, I will adapt them to resonate with Portuguese players, using idiomatic expressions if necessary and ensuring that the sense of adventure and urgency is conveyed.

For the string with the placeholder {player_name}, I will ensure that the placeholder is kept intact and that the surrounding text is grammatically correct and flows naturally in Portuguese. The name "Jonathan" will remain unchanged as it is a proper noun and recognizable in Portuguese.

JSON Output:
\`\`\`
[
  {
    "id": "CH1_Welcome",
    "English": "Welcome to Arcadian Atlas",
    "Portuguese": "Bem-vindo ao Arcadian Atlas"
  },
  {
    "id": "CH1_02",
    "English": "Arcadia is a vast land, with monsters and dangers!",
    "Portuguese": "Arcadia é uma terra vasta, repleta de monstros e perigos!"
  },
  {
    "id": "CH1_03",
    "English": "Find him {player_name}. Find him and save Arcadia. Jonathan will save us all. It is the only way.",
    "Portuguese": "Encontre-o {player_name}. Encontre-o e salve Arcadia. Jonathan nos salvará a todos. É a única maneira."
  }
]
\`\`\`
      `.trim()

            const expected = [
                {
                    id: 'CH1_Welcome',
                    English: 'Welcome to Arcadian Atlas',
                    Portuguese: 'Bem-vindo ao Arcadian Atlas'
                },
                {
                    id: 'CH1_02',
                    English: 'Arcadia is a vast land, with monsters and dangers!',
                    Portuguese: 'Arcadia é uma terra vasta, repleta de monstros e perigos!'
                },
                {
                    id: 'CH1_03',
                    English:
                        'Find him {player_name}. Find him and save Arcadia. Jonathan will save us all. It is the only way.',
                    Portuguese:
                        'Encontre-o {player_name}. Encontre-o e salve Arcadia. Jonathan nos salvará a todos. É a única maneira.'
                }
            ]

            const result = parser.parse(input, z.array(LocalizationSchema))
            expect(result).toEqual(expected)
        })

        it('should handle localization with optional fields', async () => {
            const LocalizationSchema = z.object({
                id: z.string(),
                English: z.string(),
                Portuguese: z.string().nullable().optional()
            })

            const input = `
To effectively localize these strings for a Portuguese-speaking audience, I will focus on maintaining the original tone and meaning while ensuring that the translations sound natural and culturally appropriate. For the game title "Arcadian Atlas," I will keep it unchanged as it is a proper noun and likely a branded term within the game. For the other strings, I will adapt them to resonate with Portuguese players, using idiomatic expressions if necessary and ensuring that the sense of adventure and urgency is conveyed.

For the string with the placeholder {player_name}, I will ensure that the placeholder is kept intact and that the surrounding text is grammatically correct and flows naturally in Portuguese. The name "Jonathan" will remain unchanged as it is a proper noun and recognizable in Portuguese.


[
  {
    id: "CH1_Welcome",
    English: "Welcome to Arcadian Atlas",
    Portuguese: "Bem-vindo ao Arcadian Atlas"
  },
  {
    id: "CH1_02",
    English: "Arcadia is a vast land, with monsters and dangers!",
    Portuguese: """Arcadia é uma terra vasta,

repleta de monstros e perigos!"""
  },
  {
    id: "CH1_03",
    English: "Find him {player_name}. Find him and save Arcadia. Jonathan will save us all. It is the only way.",
  }
]
      `.trim()

            const expected = [
                {
                    id: 'CH1_Welcome',
                    English: 'Welcome to Arcadian Atlas',
                    Portuguese: 'Bem-vindo ao Arcadian Atlas'
                },
                {
                    id: 'CH1_02',
                    English: 'Arcadia is a vast land, with monsters and dangers!',
                    Portuguese: 'Arcadia é uma terra vasta,\n\nrepleta de monstros e perigos!'
                },
                {
                    id: 'CH1_03',
                    English:
                        'Find him {player_name}. Find him and save Arcadia. Jonathan will save us all. It is the only way.',
                    Portuguese: undefined
                }
            ]

            // Debug: Let's see what the parser returns
            try {
                const result = parser.parse(input, z.array(LocalizationSchema))
                expect(result).toEqual(expected)
            } catch (e) {
                console.log('Parser error for localization with optional fields:')
                console.log('Error:', e)
                // Try to see what the parser returns without schema validation
                const coreParser = new (await import('../src/core-parser')).CoreParser()
                const rawResult = coreParser.parse(input, { extractFromMarkdown: true, allowMalformed: true })
                console.log('Raw parser result:', JSON.stringify(rawResult, null, 2))
                throw e
            }
        })

        it('should handle complex nested object with triple quotes', async () => {
            const HeadingSchema = z.object({
                heading: z.string(),
                python_function_code: z.string(),
                description: z.string()
            })

            const HeadingsSchema = z.object({
                headings: z.array(HeadingSchema)
            })

            const input = `
<thinking>
To create a personalized catalogue for the customer, I need to analyze both the properties available and the customer's requirements. The customer is looking for an apartment that is 970.0 sq.ft. and costs Rs. 27,030,000.00. However, none of the listed properties match these specifications perfectly.

1. **Analyze the Properties**: I'll look at the properties provided to identify common themes, features, or unique selling points that can inspire creative headings.
2. **Consider Customer Requirements**: While the customer has specific requirements, the task is to create headings that are creative and interesting, not strictly based on those requirements.
3. **Generate Creative Headings**: I will brainstorm seven catchy headings that can be used to categorize the properties in a way that highlights their best features or unique aspects.

Next, I will generate the headings and their corresponding Python functions to categorize the properties.
</thinking>

<reflection>
I have considered the properties and the customer's requirements. The next step is to formulate creative headings that reflect the unique aspects of the properties without being overly focused on the customer's specific requirements. I will ensure that each heading is distinct and engaging.
</reflection>

<thinking>
Here are the seven creative headings along with their descriptions and Python functions:

1. **Urban Oasis**
   - This heading captures properties that offer a serene living experience amidst the bustling city life.
   - Python function:
   \`\`\`python
   def is_urban_oasis(property):
       return 'Large Green Area' in property['amenities'] or 'Garden' in property['amenities']
   \`\`\`

   Now, I will compile these into the required format.
</thinking>

{
  "headings": [
    {
      "heading": "Urban Oasis",
      "python_function_code": """def is_urban_oasis(property):
       return 'Large Green Area' in property['amenities'] or 'Garden' in property['amenities']""",
      "description": "Properties that offer a serene living experience amidst the bustling city life."
    }
  ]
}
      `.trim()

            const expected = {
                headings: [
                    {
                        heading: 'Urban Oasis',
                        python_function_code: `def is_urban_oasis(property):
       return 'Large Green Area' in property['amenities'] or 'Garden' in property['amenities']`,
                        description: 'Properties that offer a serene living experience amidst the bustling city life.'
                    }
                ]
            }

            try {
                const result = parser.parse(input, HeadingsSchema)
                expect(result).toEqual(expected)
            } catch (e) {
                console.log('Parser error for complex nested object with triple quotes:')
                console.log('Error:', e)
                // Try to see what the parser returns without schema validation
                const coreParser = new (await import('../src/core-parser')).CoreParser()
                const rawResult = coreParser.parse(input, { extractFromMarkdown: true, allowMalformed: true })
                console.log('Raw parser result:', JSON.stringify(rawResult, null, 2))
                throw e
            }
        })

        it('should handle injected triple quoted strings', () => {
            const HeadingSchema = z.object({
                heading: z.string(),
                python_function_code: z.string(),
                description: z.string()
            })

            const HeadingsSchema = z.object({
                headings: z.array(HeadingSchema)
            })

            const input = `
{
  "headings": [
    {
      "heading": "Urban Oasis",
      "python_function_code": """def is_urban_oasis(property):
       return 'Large Green Area' in property['amenities'] or 'Garden' in property['amenities']""",
      "description": "Properties that offer a serene living experience amidst the bustling city life."
    }
  ]
}
      `.trim()

            const expected = {
                headings: [
                    {
                        heading: 'Urban Oasis',
                        python_function_code: `def is_urban_oasis(property):
       return 'Large Green Area' in property['amenities'] or 'Garden' in property['amenities']`,
                        description: 'Properties that offer a serene living experience amidst the bustling city life.'
                    }
                ]
            }

            const result = parser.parse(input, HeadingsSchema)
            expect(result).toEqual(expected)
        })
    })

    describe('Type Coercion', () => {
        it('should coerce number to string', () => {
            const schema = z.string()
            const input = '1'
            const expected = '1'

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should coerce string to number', () => {
            const schema = z.number()
            const input = '"123"'
            const expected = 123

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })

        it('should coerce string to boolean', () => {
            const schema = z.boolean()
            const input = '"true"'
            const expected = true

            const result = parser.parse(input, schema)
            expect(result).toBe(expected)
        })
    })

    describe('Partial/Malformed JSON', () => {
        it('should handle complex malformed JSON sequence', () => {
            // This is a very complex test case with nested objects and malformed JSON
            const Foo1Schema = z.object({
                field1: z.string(),
                field2: z.string().nullable(),
                field3: z.string().nullable(),
                field4: z.string().nullable(),
                field5: z.string().nullable(),
                field6: z.string().nullable()
            })

            const Foo2Schema = z.object({
                field7: z.string().nullable(),
                field8: z.string().nullable(),
                field9: z.string().nullable(),
                field10: z.string().nullable(),
                field11: z.string().nullable(),
                field12: z.string().nullable(),
                field13: z.string().nullable(),
                field14: z.string().nullable(),
                field15: z.string().nullable(),
                field16: z.string().nullable(),
                field17: z.string().nullable(),
                field18: z.string().nullable(),
                field19: z.string().nullable(),
                field20: z.string().nullable(),
                field21: z.string().nullable(),
                field22: z.string().nullable(),
                field23: z.string().nullable(),
                field24: z.string().nullable(),
                field25: z.string().nullable()
            })

            const Foo3Schema = z.object({
                field28: z.string(),
                field29: z.array(z.string()),
                field30: z.array(z.string()),
                field31: z.array(z.string()),
                field32: z.array(z.string()),
                field33: z.string().nullable(),
                field34: z.string().nullable(),
                field35: z.string().nullable(),
                field36: z.string().nullable()
            })

            const TestSchema = z.object({
                foo1: Foo1Schema,
                foo2: z.array(Foo2Schema),
                foo3: Foo3Schema
            })

            const input = `\`\`\`json
{
"foo1": {
"field1": "Something horrible has happened!!",
"field2": null,
"field3": null,
"field4": null,
"field5": null,
"field6": null
},
"foo2": {
"field7": null,
"field8": null,
"field9": null,
"field10": null,
"field11": null,
"field12": null,
"field13": null{
"foo1": {
"field1": "A thing has been going on poorly",
"field2": null,
"field3": null,
"field4": null,
"field5": null,
"field6": null
},
"foo2": {
"field7": null,
"field8": null,
"field9": null,
"field10": null,
"field11": null,
"field12": null,
"field13": null,
"field14": null,
"field15": null,
"field16": null,
"field17": null,
"field18": null,
"field19": null,
"field20": null,
"field21": null,
"field22": null,
"field23": null,
"field24": null,
"field25": null
},
"foo2": [
{
  "field26": "The bad thing is confirmed.",
  "field27": null
}
],
"foo3": {
"field28": "We are really going to try and take care of the bad thing.",
"field29": [],
"field30": [],
"field31": [],
"field32": [],
"field33": null,
"field34": null,
"field35": null,
"field36": null
}}`

            const expected = {
                foo1: {
                    field1: 'Something horrible has happened!!',
                    field2: null,
                    field3: null,
                    field4: null,
                    field5: null,
                    field6: null
                },
                foo2: [
                    {
                        field7: null,
                        field8: null,
                        field9: null,
                        field10: null,
                        field11: null,
                        field12: null,
                        field13: 'null{\n"foo1": {\n"field1": "A thing has been going on poorly"',
                        field14: null,
                        field15: null,
                        field16: null,
                        field17: null,
                        field18: null,
                        field19: null,
                        field20: null,
                        field21: null,
                        field22: null,
                        field23: null,
                        field24: null,
                        field25: null
                    }
                ],
                foo3: {
                    field28: 'We are really going to try and take care of the bad thing.',
                    field29: [],
                    field30: [],
                    field31: [],
                    field32: [],
                    field33: null,
                    field34: null,
                    field35: null,
                    field36: null
                }
            }

            const result = parser.parse(input, TestSchema)
            expect(result).toEqual(expected)
        })
    })
})
