// Mirrors Rust jsonish/src/helpers/common.rs

import { z } from 'zod'

// Common test schemas
export const SIMPLE_SCHEMA = z.object({
  name: z.string(),
  age: z.number().int(),
  active: z.boolean()
}).describe('Person')

export const UNION_SCHEMA = z.union([
  z.object({ type: z.literal('user'), name: z.string() }),
  z.object({ type: z.literal('admin'), name: z.string(), permissions: z.array(z.string()) })
]).describe('UserOrAdmin')

export const NESTED_SCHEMA = z.object({
  id: z.string(),
  user: z.object({
    name: z.string(),
    email: z.string().email().optional()
  }),
  tags: z.array(z.string())
}).describe('UserProfile')

export const ENUM_SCHEMA = z.enum(['red', 'green', 'blue']).describe('Color')

// Common test JSON strings
export const JSON_STRING = `{
  "name": "John Doe",
  "age": 30,
  "active": true
}`

export const INVALID_JSON = `{
  "name": "John Doe",
  "age": "thirty",
  active: yes
}`

export const PARTIAL_JSON = `{
  "name": "John Doe",
  "age": 30`

export const ARRAY_JSON = `[
  {"name": "Alice", "age": 25},
  {"name": "Bob", "age": 30}
]`

export const NESTED_JSON = `{
  "id": "123",
  "user": {
    "name": "Alice",
    "email": "alice@example.com"
  },
  "tags": ["developer", "typescript"]
}`

// Test data for streaming
export const STREAMING_CHUNKS = [
  '{"name": "Jo',
  'hn Doe", "a',
  'ge": 30, "ac',
  'tive": true}'
]

// Map test data
export const MAP_SCHEMA = z.record(z.string(), z.number()).describe('StringToNumberMap')

export const MAP_JSON = `{
  "one": 1,
  "two": 2,
  "three": 3
}`