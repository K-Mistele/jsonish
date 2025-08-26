import { parseWithStateMachine } from './state-machine.js';
import { Value } from './value.js';

export function fixJson(input: string): string {
  let fixed = input.trim();
  
  // Handle triple-quoted strings: """content""" → "content"
  fixed = fixed.replace(/"""([\s\S]*?)"""/g, (match, content) => {
    return `"${content.replace(/"/g, '\\"')}"`;
  });
  
  // Fix unquoted keys: {key: "value"} → {"key": "value"}
  fixed = fixed.replace(/(\{|\s)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  
  // Fix unquoted string values (but not numbers/booleans)
  fixed = fixed.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_\s]+?)(\s*[,}])/g, (match, value, ending) => {
    // Don't quote if it looks like a boolean or number
    const trimmed = value.trim();
    if (/^(true|false|null|\d+(\.\d+)?)$/i.test(trimmed)) {
      return `: ${trimmed}${ending}`;
    }
    return `: "${trimmed}"${ending}`;
  });
  
  // Fix trailing commas in arrays: [1,2,3,] → [1,2,3]
  fixed = fixed.replace(/,\s*]/g, ']');
  
  // Fix trailing commas in objects: {"a":1,} → {"a":1}  
  fixed = fixed.replace(/,\s*}/g, '}');
  
  // Auto-close missing brackets and quotes
  fixed = autoCloseBrackets(fixed);
  fixed = autoCloseQuotes(fixed);
  
  return fixed;
}

export function parseWithAdvancedFixing(input: string): { value: Value; fixes: string[] } {
  // Try the state machine parser for advanced error recovery
  return parseWithStateMachine(input);
}

function autoCloseBrackets(input: string): string {
  const stack: string[] = [];
  let result = input;
  
  for (const char of input) {
    if (char === '[' || char === '{') {
      stack.push(char === '[' ? ']' : '}');
    } else if (char === ']' || char === '}') {
      stack.pop();
    }
  }
  
  // Close remaining open structures
  while (stack.length > 0) {
    result += stack.pop();
  }
  
  return result;
}

function autoCloseQuotes(input: string): string {
  let result = input;
  let inQuotes = false;
  let escaped = false;
  
  // Simple approach: if we end with an incomplete quote, close it
  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
    }
  }
  
  if (inQuotes) {
    result += '"';
  }
  
  return result;
}