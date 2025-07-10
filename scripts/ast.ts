// index.ts
import * as parser from "@babel/parser";

const code = `
function square(n) {
  console.log("calculating...");
  return n * n;
}
`;

// Use the parser to generate the AST
const ast = parser.parse(code);

// Let's see what it looks like!
console.log(JSON.stringify(ast, null, 2));
