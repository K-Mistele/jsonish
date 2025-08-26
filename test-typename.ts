import { z } from 'zod'

const stringSchema = z.string()
const numberSchema = z.number()
const arraySchema = z.array(z.number())

console.log('String schema _def:', stringSchema._def)
console.log('Number schema _def:', numberSchema._def)
console.log('Array schema _def:', arraySchema._def)