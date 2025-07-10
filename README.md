# JSONish Parser

A robust, schema-aware JSON parser for TypeScript that handles malformed JSON, mixed content, and intelligent type coercion. This is a TypeScript port of BAML's JSONish parser, designed to parse "JSON-ish" content that doesn't strictly conform to JSON specifications.

## What is JSONish?

JSONish is a flexible JSON parser that can handle real-world scenarios where JSON might be:
- **Malformed** (trailing commas, unquoted keys, incomplete structures)
- **Mixed with text** (JSON embedded in natural language or markdown)
- **Partially complete** (streaming or incomplete data)
- **Needs type coercion** (strings that should be numbers, case variations in booleans)

## Key Features

### 🔧 Schema-Aware Parsing
Uses Zod schemas to define expected output structure and performs intelligent type coercion:

```typescript
import { createParser } from './src/parser';
import { z } from 'zod';

const parser = createParser();

const userSchema = z.object({
  name: z.string(),
  age: z.number(),
  active: z.boolean().optional()
});

// Parse malformed JSON with type coercion
const result = parser.parse(
  '{"name": "Alice", "age": "30", "active": True}', // Note: "30" as string, True with capital T
  userSchema
);
// Result: { name: "Alice", age: 30, active: true }
```

### 📝 Mixed Content Extraction
Extract JSON from text, markdown, and other mixed content:

```typescript
const chatSchema = z.object({
  message: z.string(),
  timestamp: z.number()
});

// Extract JSON from natural language
const input = `The user sent a message: {"message": "Hello world", "timestamp": 1234567890}`;
const result = parser.parse(input, chatSchema);
// Result: { message: "Hello world", timestamp: 1234567890 }

// Extract from markdown code blocks
const markdown = `
Here's the user data:
\`\`\`json
{
  "message": "Hello from markdown",
  "timestamp": 1234567890
}
\`\`\`
`;
const result2 = parser.parse(markdown, chatSchema, { extractFromMarkdown: true });
```

### 🛠️ Malformed JSON Recovery
Handle common JSON formatting issues:

```typescript
const productSchema = z.object({
  name: z.string(),
  price: z.number(),
  tags: z.array(z.string())
});

// Handles trailing commas, unquoted keys, etc.
const malformedJson = `{
  name: "Product Name",
  price: 29.99,
  tags: ["electronics", "gadgets",],
}`;

const result = parser.parse(malformedJson, productSchema, { allowMalformed: true });
// Result: { name: "Product Name", price: 29.99, tags: ["electronics", "gadgets"] }
```

### 🔄 Intelligent Type Coercion
Automatically convert between compatible types:

```typescript
const configSchema = z.object({
  enabled: z.boolean(),
  count: z.number(),
  items: z.array(z.string())
});

// Various type coercions
const input = `{
  "enabled": "true",        // String to boolean
  "count": "42",           // String to number  
  "items": "single-item"   // Single value to array
}`;

const result = parser.parse(input, configSchema, { coerceTypes: true });
// Result: { enabled: true, count: 42, items: ["single-item"] }
```

### 🎯 Union Type Resolution
Smart handling of union types with automatic discrimination:

```typescript
const taskSchema = z.union([
  z.object({ type: z.literal("user"), name: z.string() }),
  z.object({ type: z.literal("admin"), permissions: z.array(z.string()) })
]);

const userInput = `{"type": "user", "name": "Alice"}`;
const adminInput = `{"type": "admin", "permissions": ["read", "write"]}`;

const userResult = parser.parse(userInput, taskSchema);
const adminResult = parser.parse(adminInput, taskSchema);
```

### 📊 Enum Handling
Case-insensitive enum matching:

```typescript
const statusSchema = z.enum(["ACTIVE", "INACTIVE", "PENDING"]);

// All of these work:
parser.parse('"active"', statusSchema);     // "ACTIVE"
parser.parse('"Active"', statusSchema);     // "ACTIVE"  
parser.parse('"ACTIVE"', statusSchema);     // "ACTIVE"
parser.parse('"inactive"', statusSchema);   // "INACTIVE"
```

### 🗺️ Dynamic Maps/Records
Parse objects with dynamic keys:

```typescript
const settingsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

const input = `{
  "theme": "dark",
  "notifications": true,
  "max_items": 50,
  "custom_field_123": "value"
}`;

const result = parser.parse(input, settingsSchema);
// Result: { theme: "dark", notifications: true, max_items: 50, custom_field_123: "value" }
```

## Advanced Features

### 🔄 Streaming Support
Parse incomplete JSON for real-time scenarios:

```typescript
const partialSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  status: z.string().optional()
});

// Incomplete JSON from streaming
const partialJson = `{"id": "123", "name": "Alice"`;
const result = parser.parse(partialJson, partialSchema, { allowPartial: true });
// Result: { id: "123", name: "Alice", status: undefined }
```

### 📝 Code Block Extraction
Extract JSON from various code block formats:

```typescript
const codeWithJson = `
Here's the configuration:
\`\`\`json
{"api_key": "secret", "timeout": 5000}
\`\`\`

And here's some YAML:
\`\`\`yaml
database:
  host: localhost
  port: 5432
\`\`\`
`;

const configSchema = z.object({
  api_key: z.string(),
  timeout: z.number()
});

const result = parser.parse(codeWithJson, configSchema, { extractFromMarkdown: true });
```

### 🐍 Code Generation Without Escaping
Perfect for code generation scenarios where you need to embed JSON in multi-line strings:

```typescript
const componentSchema = z.object({
  name: z.string(),
  props: z.object({
    className: z.string(),
    onClick: z.string(),
    children: z.string()
  })
});

// Python-style multi-line string with unescaped quotes
const pythonGeneratedCode = `
def generate_component():
    return '''
    {
        "name": "Button",
        "props": {
            "className": "btn-primary",
            "onClick": "handleClick()",
            "children": "Click me!"
        }
    }
    '''
`;

const result = parser.parse(pythonGeneratedCode, componentSchema);
// Result: { name: "Button", props: { className: "btn-primary", onClick: "handleClick()", children: "Click me!" } }

// Also works with JavaScript template literals
const jsGeneratedCode = `
const template = \`
{
    "component": "Dialog",
    "props": {
        "title": "Confirm Action",
        "message": "Are you sure you want to delete this item?",
        "buttons": ["Cancel", "Delete"]
    }
}
\`;
`;

const dialogSchema = z.object({
  component: z.string(),
  props: z.object({
    title: z.string(),
    message: z.string(),
    buttons: z.array(z.string())
  })
});

const dialogResult = parser.parse(jsGeneratedCode, dialogSchema);
```

## Parser Options

```typescript
interface ParseOptions {
  allowPartial?: boolean;        // Handle incomplete JSON for streaming
  extractFromMarkdown?: boolean; // Extract JSON from markdown code blocks
  allowMalformed?: boolean;      // Recover from malformed JSON
  coerceTypes?: boolean;         // Perform intelligent type coercion
}
```

## Test Coverage

This implementation includes comprehensive test coverage based on BAML's Rust implementation:

- **236+ test cases** covering all major scenarios
- **12 test categories** including basics, objects, arrays, enums, unions, literals, maps, and advanced features
- **Real-world scenarios** like malformed JSON, mixed content, and streaming data
- **Edge cases** and error handling

## Usage

```typescript
import { createParser } from './src/parser';
import { z } from 'zod';

const parser = createParser();

// Define your schema
const schema = z.object({
  name: z.string(),
  age: z.number(),
  tags: z.array(z.string()).optional()
});

// Parse with options
const result = parser.parse(input, schema, {
  allowMalformed: true,
  coerceTypes: true,
  extractFromMarkdown: true
});
```

## Development Status

- ✅ **Complete test suite** with 236+ comprehensive tests
- ✅ **Full TypeScript types** with Zod schema integration
- ⏳ **Parser implementation** in progress
- 📋 **Advanced features** (streaming, constraints) planned

## Contributing

This project uses Bun for development:

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run specific test file
bun test test/basics.test.ts
```

## License

Licensed under the same terms as the original BAML implementation.