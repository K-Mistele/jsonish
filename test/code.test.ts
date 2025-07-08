import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createParser } from "../src/parser";

const parser = createParser();

describe("Code Blocks", () => {
	describe("Quote Handling", () => {
		const TestSchema = z.object({
			type: z.literal("code"),
			code: z.string(),
		});

		test("should parse code with backticks", () => {
			const input = `{
        "type": "code",
        "code": \`print("Hello, world!")\`
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse code with single quotes", () => {
			const input = `{
        "type": "code",
        "code": 'print("Hello, world!")'
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse code with double quotes", () => {
			const input = `{
        "type": "code",
        "code": "print(\\"Hello, world!\\")"
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse unquoted string", () => {
			const input = `{
        "type": "code",
        "code": "print(\\"Hello, world!\\")"
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse code with triple quotes", () => {
			const input = `{
        "type": "code",
        "code": """print("Hello, world!")"""
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Triple Quotes Special Cases", () => {
		const TestSchema = z.object({
			type: z.literal("code"),
			code: z.string(),
		});

		test("should parse triple quotes containing only quoted string", () => {
			const input = `{
        "code": """
"Hello, world!"
"""
        "type": "code",
      }`;

			const expected = {
				type: "code" as const,
				code: '"Hello, world!"',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse triple quotes with dedentation", () => {
			const input = `{
        "code": """
            def main():
              print("Hello, world!")
        """,
        "type": "code",
      }`;

			const expected = {
				type: "code" as const,
				code: 'def main():\n  print("Hello, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Unescaped Newlines", () => {
		const TestSchema = z.object({
			type: z.literal("code"),
			code: z.string(),
		});

		test("should handle unescaped newline in double quotes", () => {
			const input = `{
        "type": "code",
        "code": "print(\\"Hello, world!
Goodbye, world!\\")"
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!\nGoodbye, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle unescaped newline in backticks", () => {
			const input = `{
        "type": "code",
        "code": \`print("Hello, world!
Goodbye, world!")\`
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!\nGoodbye, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle unescaped newline in single quotes", () => {
			const input = `{
        "type": "code",
        "code": 'print("Hello, world!
Goodbye, world!")'
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!\nGoodbye, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle unescaped newline in triple quotes", () => {
			const input = `{
        "type": "code",
        "code": """print("Hello, world!
Goodbye, world!")"""
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!\nGoodbye, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Unescaped Quotes", () => {
		const TestSchema = z.object({
			type: z.literal("code"),
			code: z.string(),
		});

		test("should handle unescaped double quotes in double quotes", () => {
			const input = `{
        "type": "code",
        "code": "print("Hello, world!")"
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle unescaped double quotes in backticks", () => {
			const input = `{
        "type": "code",
        "code": \`print("Hello, world!")\`
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle unescaped single quotes in single quotes", () => {
			const input = `{
        "type": "code",
        "code": 'print('Hello, world!')'
      }`;

			const expected = {
				type: "code" as const,
				code: "print('Hello, world!')",
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle unescaped double quotes in triple quotes", () => {
			const input = `{
        "type": "code",
        "code": """print("Hello, world!")"""
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Hello, world!")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test.skip("should handle unescaped single quotes in triple quotes (known issue)", () => {
			// This test is marked as skip because it's a known parsing issue in the Rust implementation
			// https://github.com/BoundaryML/baml/issues/1145
			const input = `{
        "type": "code",
        "code": """print("""Hello, world!""")"""
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle unescaped backticks in backticks", () => {
			const input = `{
        "type": "code",
        "code": \`console.log(\`Hello, world!\`)\`
      }`;

			const expected = {
				type: "code" as const,
				code: "console.log(`Hello, world!`)",
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Multiline Code", () => {
		const TestSchema = z.object({
			type: z.literal("code"),
			code: z.string(),
		});

		test("should parse multiline code with triple quotes", () => {
			const input = `{
        "type": "code",
        "code": """
def hello():
    print("Hello, world!")
    return True
"""
      }`;

			const expected = {
				type: "code" as const,
				code: '\ndef hello():\n    print("Hello, world!")\n    return True\n',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse code with embedded quotes", () => {
			const input = `{
        "type": "code",
        "code": \`print("He said, 'Hello!'")\`
      }`;

			const expected = {
				type: "code" as const,
				code: "print(\"He said, 'Hello!'\")",
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse code with escape sequences", () => {
			const input = `{
        "type": "code",
        "code": "print(\\"Line 1\\\\nLine 2\\")"
      }`;

			const expected = {
				type: "code" as const,
				code: 'print("Line 1\\nLine 2")',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Complex Code Blocks", () => {
		const TestSchema = z.object({
			type: z.literal("code"),
			language: z.string().optional(),
			code: z.string(),
		});

		test("should parse JSON code block", () => {
			const input = `{
        "type": "code",
        "language": "json",
        "code": \`{
  "name": "test",
  "value": 123
}\`
      }`;

			const expected = {
				type: "code" as const,
				language: "json",
				code: '{\n  "name": "test",\n  "value": 123\n}',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse Python code with nested structures", () => {
			const input = `{
        "type": "code",
        "language": "python",
        "code": """
class Example:
    def __init__(self):
        self.data = {"key": "value"}
    
    def process(self):
        return [1, 2, 3]
"""
      }`;

			const expected = {
				type: "code" as const,
				language: "python",
				code: '\nclass Example:\n    def __init__(self):\n        self.data = {"key": "value"}\n    \n    def process(self):\n        return [1, 2, 3]\n',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse code with markdown formatting", () => {
			const input = `{
        "type": "code",
        "code": \`\`\`python
def hello():
    print("Hello!")
\`\`\`
      }`;

			const expected = {
				type: "code" as const,
				code: '```python\ndef hello():\n    print("Hello!")\n```',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Edge Cases", () => {
		const TestSchema = z.object({
			type: z.literal("code"),
			code: z.string(),
		});

		test("should handle empty code", () => {
			const input = `{
        "type": "code",
        "code": ""
      }`;

			const expected = {
				type: "code" as const,
				code: "",
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle code with only whitespace", () => {
			const input = `{
        "type": "code",
        "code": "   \\n\\t   "
      }`;

			const expected = {
				type: "code" as const,
				code: "   \n\t   ",
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle code with special characters", () => {
			const input = `{
        "type": "code",
        "code": \`console.log("$@#%^&*()");\`
      }`;

			const expected = {
				type: "code" as const,
				code: 'console.log("$@#%^&*()");',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle code with unicode", () => {
			const input = `{
        "type": "code",
        "code": "print('Hello 世界! 🌍')"
      }`;

			const expected = {
				type: "code" as const,
				code: "print('Hello 世界! 🌍')",
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse code from text with unquoted strings", () => {
			const input = `{
        type: code,
        code: function test() { return "hello"; }
      }`;

			const expected = {
				type: "code" as const,
				code: 'function test() { return "hello"; }',
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Large Code Blocks", () => {
		const TestSchema = z.object({
			type: z.literal("code"),
			code: z.string(),
		});

		test("should parse large code with backticks", () => {
			const input = `{
        "type": "code",
        "code": \`import { query } from './_generated/server';
import { v } from 'convex/values';

export default query(async (ctx) => {
  const posts = await ctx.db
    .query('posts')
    .order('desc')
    .collect();

  const postsWithDetails = await Promise.all(
    posts.map(async (post) => {
      // Fetch author information
      const author = await ctx.db.get(post.authorId);
      if (!author) {
        throw new Error('Author not found');
      }

      // Count upvotes
      const upvotes = await ctx.db
        .query('upvotes')
        .filter((q) => q.eq(q.field('postId'), post._id))
        .collect();

      return {
        id: post._id.toString(),
        title: post.title,
        content: post.content,
        author: {
          id: author._id.toString(),
          name: author.name,
        },
        upvoteCount: upvotes.length,
        createdAt: post._creationTime.toString(),
      };
    })
  );

  return postsWithDetails;
})\`
      }`;

			const expected = {
				type: "code" as const,
				code: `import { query } from './_generated/server';
import { v } from 'convex/values';

export default query(async (ctx) => {
  const posts = await ctx.db
    .query('posts')
    .order('desc')
    .collect();

  const postsWithDetails = await Promise.all(
    posts.map(async (post) => {
      // Fetch author information
      const author = await ctx.db.get(post.authorId);
      if (!author) {
        throw new Error('Author not found');
      }

      // Count upvotes
      const upvotes = await ctx.db
        .query('upvotes')
        .filter((q) => q.eq(q.field('postId'), post._id))
        .collect();

      return {
        id: post._id.toString(),
        title: post.title,
        content: post.content,
        author: {
          id: author._id.toString(),
          name: author.name,
        },
        upvoteCount: upvotes.length,
        createdAt: post._creationTime.toString(),
      };
    })
  );

  return postsWithDetails;
})`,
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Triple Backticks", () => {
		const TestSchema = z.object({
			type: z.literal("code"),
			code: z.string(),
		});

		test("should parse triple backticks", () => {
			const input = `Here's a comparison of TypeScript and Ruby code for checking the main Git branch using subprocesses:

{
  "code": \`\`\`
const { execSync } = require('child_process');

function getMainBranch(): string {
  try {
    // Try 'main' first
    const mainExists = execSync('git rev-parse --verify main 2>/dev/null', { encoding: 'utf8' });
    if (mainExists) return 'main';
  } catch {
    // Try 'master' if 'main' doesn't exist
    try {
      const masterExists = execSync('git rev-parse --verify master 2>/dev/null', { encoding: 'utf8' });
      if (masterExists) return 'master';
    } catch {
      throw new Error('Neither main nor master branch found');
    }
  }

  throw new Error('Unable to determine main branch');
}

// Usage
try {
  const mainBranch = getMainBranch();
  console.log(\`Main branch is: \${mainBranch}\`);
} catch (error) {
  console.error(\`Error: \${error.message}\`);
}
\`\`\`,
    "type": "code",
}

Both versions will:
1. First check if 'main' exists
2. If not, check if 'master' exists
3. Return the appropriate branch name
4. Throw/raise an error if neither exists
5. Handle errors gracefully

The main difference is that Ruby uses the special \`$?\` variable to check command success, while TypeScript relies on try/catch with execSync.`;

			const expected = {
				type: "code" as const,
				code: `const { execSync } = require('child_process');

function getMainBranch(): string {
  try {
    // Try 'main' first
    const mainExists = execSync('git rev-parse --verify main 2>/dev/null', { encoding: 'utf8' });
    if (mainExists) return 'main';
  } catch {
    // Try 'master' if 'main' doesn't exist
    try {
      const masterExists = execSync('git rev-parse --verify master 2>/dev/null', { encoding: 'utf8' });
      if (masterExists) return 'master';
    } catch {
      throw new Error('Neither main nor master branch found');
    }
  }

  throw new Error('Unable to determine main branch');
}

// Usage
try {
  const mainBranch = getMainBranch();
  console.log(\`Main branch is: \${mainBranch}\`);
} catch (error) {
  console.error(\`Error: \${error.message}\`);
}`,
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should parse triple quotes containing backtick string", () => {
			const input = `{
        "code": \`\`\`
\`Hello, world!\`
\`\`\`,
        "type": "code",
      }`;

			const expected = {
				type: "code" as const,
				code: "`Hello, world!`",
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should dedent triple backticks and discard language info", () => {
			const input = `Here's a comparison of TypeScript and Ruby code for checking the main Git branch using subprocesses:

{
  "code": \`\`\`typescript main.ts
    const async function main() {
      console.log("Hello, world!");
    }
\`\`\`,
    "type": "code",
}`;

			const expected = {
				type: "code" as const,
				code: `const async function main() {
  console.log("Hello, world!");
}`,
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle triple backticks with JSON terminators", () => {
			const input = `Here's a comparison of TypeScript and Ruby code for checking the main Git branch using subprocesses:

{
  "code": \`\`\`
  { type: "code", code: "aaa", closing_terminators: }}}]])) }
\`\`\`,
    "type": "code",
}`;

			const expected = {
				type: "code" as const,
				code: `{ type: "code", code: "aaa", closing_terminators: }}}]])) }`,
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should handle triple backticks in JSON fenced codeblock", () => {
			const input = `Here's a comparison of TypeScript and Ruby code for checking the main Git branch using subprocesses:

\`\`\`json
{
  "code": \`\`\`
  { type: "code", code: "aaa", closing_terminators: }}}]])) }
\`\`\`,
    "type": "code",
}
\`\`\``;

			const expected = {
				type: "code" as const,
				code: `{ type: "code", code: "aaa", closing_terminators: }}}]])) }`,
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});

		test("should preserve triple backticks in strings", () => {
			const input = `Here's a comparison of TypeScript and Ruby code for checking the main Git branch using subprocesses:

\`\`\`json
{
  "code": "\`\`\`
const { execSync } = require('child_process');
\`\`\`",
    "type": "code",
}
\`\`\``;

			const expected = {
				type: "code" as const,
				code: "```\nconst { execSync } = require('child_process');\n```",
			};

			const result = parser.parse(input, TestSchema);
			expect(result).toEqual(expected);
		});
	});
});
