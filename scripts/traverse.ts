// index.ts
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";

const code = `
function square(n) {
  console.log("calculating...");
  return n * n;
}

console.error("Something is wrong!");
`;

const ast = parser.parse(code);

// The traverse function takes the AST and a visitor object
traverse(ast, {
	// We are interested in visiting every 'CallExpression' node
	CallExpression(path) {
		// A 'path' is an object that represents the link between a parent and child node.
		// It has a ton of useful information, including the node itself.
		const node = path.node;
		console.log("Found a CallExpression!");

		// Let's check if it's 'console.log'
		// The 'callee' is the thing being called. In 'console.log()', the callee is 'console.log'.
		// This is a 'MemberExpression' because it has an object ('console') and a property ('log').
		if (node.callee.type === "MemberExpression") {
			const callee = node.callee;
			if (
				callee.object.type === "Identifier" &&
				callee.object.name === "console"
			) {
				console.log(`  - It's a console call: ${callee.property.name}`);
			}
		}
	},
});
