import generate from "@babel/generator";
// index.ts
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types"; // Import all type helpers as 't'

const code = `
function square(n) {
  console.log("calculating...");
  return n * n;
}

console.error("Something is wrong!");
`;

const ast = parser.parse(code);

traverse(ast, {
	CallExpression(path) {
		const callee = path.get("callee"); // Using path.get is often safer

		// We can use the type checkers from @babel/types for cleaner code!
		// The pattern for 'console.log' is a callee that is a MemberExpression.
		if (callee.isMemberExpression()) {
			const object = callee.get("object");
			const property = callee.get("property");

			// Check if it's console.log
			if (
				object.isIdentifier({ name: "console" }) &&
				property.isIdentifier({ name: "log" })
			) {
				console.log("Found a console.log! Changing it to console.warn");

				// HERE'S THE MAGIC: We modify the AST directly
				// We create a new Identifier 'warn' and replace 'log' with it.
				const newIdentifier = t.identifier("warn");
				path.node.callee.property = newIdentifier;
			}
		}
	},
});

// Step 4: Generating Code from our Modified AST
const output = generate(ast, {}, code);

console.log("\n--- ORIGINAL CODE ---\n", code);
console.log("\n--- TRANSFORMED CODE ---\n", output.code);
