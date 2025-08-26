import { Value, createValueFromParsed, createStringValue } from './value.js';
import { parseWithStateMachine } from './state-machine.js';

export function extractJsonFromText(input: string): Value[] {
  const candidates: Value[] = [];
  
  // Extract from markdown code blocks
  const codeBlocks = extractMarkdownCodeBlocks(input);
  candidates.push(...codeBlocks);
  
  // Extract JSON-like patterns from text  
  const jsonPatterns = extractJsonPatterns(input);
  candidates.push(...jsonPatterns);
  
  return candidates;
}

export function extractMultipleObjects(input: string): Value[] {
  const objects: Value[] = [];
  
  // Find multiple object patterns
  const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let match;
  while ((match = objectRegex.exec(input)) !== null) {
    const jsonStr = match[0];
    try {
      const parsed = JSON.parse(jsonStr);
      objects.push(createValueFromParsed(parsed));
    } catch {
      // Try with basic fixes
      try {
        const fixed = basicJsonFix(jsonStr);
        const parsed = JSON.parse(fixed);
        objects.push(createValueFromParsed(parsed));
      } catch {
        // Try with state machine parser
        try {
          const { value } = parseWithStateMachine(jsonStr);
          objects.push(value);
        } catch {
          // Skip invalid objects
        }
      }
    }
  }
  
  return objects;
}

function extractMarkdownCodeBlocks(input: string): Value[] {
  const blocks: Value[] = [];
  
  // Regular pattern for complete markdown blocks
  const completeRegex = /```(?:json|javascript)?\s*\n?([\s\S]*?)\n?```/g;
  let match;
  let matchCount = 0;
  
  while ((match = completeRegex.exec(input)) !== null) {
    matchCount++;
    const content = match[1].trim();
    try {
      const parsed = JSON.parse(content);
      blocks.push(createValueFromParsed(parsed));
    } catch {
      // Try with state machine parser  
      try {
        const { value } = parseWithStateMachine(content);
        blocks.push(value);
      } catch {
        // Store as string for further processing
        blocks.push(createStringValue(content));
      }
    }
  }
  
  // Handle incomplete markdown blocks (opening ``` but no closing ```)
  if (matchCount === 0) {
    const incompleteRegex = /```(?:json|javascript)?\s*\n?([\s\S]*)$/;
    const incompleteMatch = input.match(incompleteRegex);
    if (incompleteMatch) {
      const content = incompleteMatch[1].trim();
      try {
        const parsed = JSON.parse(content);
        blocks.push(createValueFromParsed(parsed));
      } catch {
        // Try with state machine parser  
        try {
          const { value } = parseWithStateMachine(content);
          blocks.push(value);
        } catch {
          // Store as string for further processing
          blocks.push(createStringValue(content));
        }
      }
    }
  }
  
  return blocks;
}

function extractJsonPatterns(input: string): Value[] {
  const candidates: Value[] = [];
  
  // Extract complete object-like patterns: {"key": "value"}
  const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let match;
  while ((match = objectRegex.exec(input)) !== null) {
    const jsonStr = match[0];
    try {
      const parsed = JSON.parse(jsonStr);
      candidates.push(createValueFromParsed(parsed));
    } catch {
      // Try with basic fixes
      try {
        const fixed = basicJsonFix(jsonStr);
        const parsed = JSON.parse(fixed);
        candidates.push(createValueFromParsed(parsed));
      } catch {
        // Try with state machine parser
        try {
          const { value } = parseWithStateMachine(jsonStr);
          candidates.push(value);
        } catch {
          // Store as string for further processing
          candidates.push(createStringValue(jsonStr));
        }
      }
    }
  }
  
  // Extract incomplete object-like patterns: {"key": "value (no closing brace)
  const incompleteObjectRegex = /\{[^{}]*$/g;
  while ((match = incompleteObjectRegex.exec(input)) !== null) {
    const jsonStr = match[0];
    try {
      const fixed = basicJsonFix(jsonStr);
      const parsed = JSON.parse(fixed);
      candidates.push(createValueFromParsed(parsed));
    } catch {
      // Try with state machine parser
      try {
        const { value } = parseWithStateMachine(jsonStr);
        candidates.push(value);
      } catch {
        // Store as string
        candidates.push(createStringValue(jsonStr));
      }
    }
  }
  
  // Extract complete array-like patterns: [1, 2, 3]
  const arrayRegex = /\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/g;
  while ((match = arrayRegex.exec(input)) !== null) {
    const jsonStr = match[0];
    try {
      const parsed = JSON.parse(jsonStr);
      candidates.push(createValueFromParsed(parsed));
    } catch {
      // Try with basic fixes
      try {
        const fixed = basicJsonFix(jsonStr);
        const parsed = JSON.parse(fixed);
        candidates.push(createValueFromParsed(parsed));
      } catch {
        // Store as string
        candidates.push(createStringValue(jsonStr));
      }
    }
  }
  
  // Extract incomplete array-like patterns: [1, 2, 3 (no closing bracket)
  const incompleteArrayRegex = /\[[^\[\]]*$/g;
  while ((match = incompleteArrayRegex.exec(input)) !== null) {
    const jsonStr = match[0];
    try {
      const fixed = basicJsonFix(jsonStr);
      const parsed = JSON.parse(fixed);
      candidates.push(createValueFromParsed(parsed));
    } catch {
      // Try with state machine parser
      try {
        const { value } = parseWithStateMachine(jsonStr);
        candidates.push(value);
      } catch {
        // Store as string
        candidates.push(createStringValue(jsonStr));
      }
    }
  }
  
  return candidates;
}

function basicJsonFix(input: string): string {
  let fixed = input;
  
  // Handle triple-quoted strings first
  fixed = fixed.replace(/"""([\s\S]*?)"""/g, (match, content) => {
    return `"${content.replace(/"/g, '\\"')}"`;
  });
  
  // Fix unquoted keys: {key: "value"} → {"key": "value"}
  fixed = fixed.replace(/(\{|\s)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  
  // Fix unquoted string values (more sophisticated)
  fixed = fixed.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_\s]+?)(\s*[,}])/g, (match, value, ending) => {
    const trimmed = value.trim();
    // Don't quote numbers, booleans, or null
    if (/^(true|false|null|\d+(\.\d+)?)$/i.test(trimmed)) {
      return `: ${trimmed}${ending}`;
    }
    return `: "${trimmed}"${ending}`;
  });
  
  // Fix trailing commas
  fixed = fixed.replace(/,\s*]/g, ']');
  fixed = fixed.replace(/,\s*}/g, '}');
  
  // Auto-close brackets
  const stack: string[] = [];
  for (const char of fixed) {
    if (char === '[' || char === '{') {
      stack.push(char === '[' ? ']' : '}');
    } else if (char === ']' || char === '}') {
      stack.pop();
    }
  }
  while (stack.length > 0) {
    fixed += stack.pop();
  }
  
  return fixed;
}