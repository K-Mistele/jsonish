import z from 'zod'

function parse<T extends z.ZodType>(text: string, schema: T): z.infer<T>

const schema = z.object({
    name: z.string()
})

const result = parse('{"name": "kyle"}', schema)
result.name
