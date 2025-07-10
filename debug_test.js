import { z } from 'zod'
import { createParser } from './src/index.js'

const parser = createParser()

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

console.log('Input:', input)
console.log('Input length:', input.length)

try {
    const result = parser.parse(input, HeadingsSchema)
    console.log('Result:', JSON.stringify(result, null, 2))
} catch (e) {
    console.error('Error:', e.message)
    console.error('Full error:', e)
}
