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
  let incompleteMatch;
  while ((incompleteMatch = incompleteObjectRegex.exec(input)) !== null) {
    const jsonStr = incompleteMatch[0];
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
  
  // Fix unquoted string values using sophisticated approach FIRST
  // This must come before key fixing to avoid corrupting function signatures
  fixed = fixComplexUnquotedValues(fixed);
  
  // Then fix unquoted keys: {key: "value"} → {"key": "value"}
  // But be more careful to only match actual object keys, not colons inside quoted strings
  fixed = fixUnquotedKeys(fixed);
  
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

function fixUnquotedKeys(input: string): string {
  let result = '';
  let i = 0;
  let inQuotes = false;
  let quoteChar = '';
  
  while (i < input.length) {
    const char = input[i];
    
    // Track quoted strings to avoid processing content inside them
    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      result += char;
    } else if (inQuotes && char === quoteChar) {
      // Check for escape character
      if (i > 0 && input[i-1] !== '\\') {
        inQuotes = false;
        quoteChar = '';
      }
      result += char;
    } else if (!inQuotes) {
      // Only fix unquoted keys when we're not inside a quoted string
      if (char === '{' || /\s/.test(char)) {
        result += char;
        // Look ahead for unquoted key pattern
        let j = i + 1;
        while (j < input.length && /\s/.test(input[j])) j++; // Skip whitespace
        
        if (j < input.length && /[a-zA-Z_]/.test(input[j])) {
          // Found start of potential key
          const keyStart = j;
          while (j < input.length && /[a-zA-Z0-9_]/.test(input[j])) j++;
          
          // Check if followed by colon (with possible whitespace)
          let k = j;
          while (k < input.length && /\s/.test(input[k])) k++;
          
          if (k < input.length && input[k] === ':') {
            // This is an unquoted key, add quotes
            const key = input.slice(keyStart, j);
            result += input.slice(i + 1, keyStart) + `"${key}"`;
            i = j - 1; // -1 because loop will increment
          }
        }
      } else {
        result += char;
      }
    } else {
      result += char;
    }
    
    i++;
  }
  
  return result;
}

function fixComplexUnquotedValues(input: string): string {
  let result = '';
  let i = 0;
  
  while (i < input.length) {
    // Look for pattern: ": <unquoted value>"
    if (i > 0 && input[i-1] === ':' && /\s/.test(input[i])) {
      // Skip whitespace after colon
      while (i < input.length && /\s/.test(input[i])) {
        result += input[i];
        i++;
      }
      
      if (i >= input.length) break;
      
      // Check if we need to quote this value
      const valueStart = i;
      let valueEnd = valueStart;
      let parenDepth = 0;
      let braceDepth = 0;
      let bracketDepth = 0;
      
      // Find the end of the unquoted value, respecting balanced delimiters
      while (valueEnd < input.length) {
        const char = input[valueEnd];
        
        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (char === '{') braceDepth++;
        else if (char === '}') braceDepth--;
        else if (char === '[') bracketDepth++;
        else if (char === ']') bracketDepth--;
        else if ((char === ',' || char === '}' || char === ']') && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
          // Found the end of the value
          break;
        }
        
        valueEnd++;
      }
      
      const value = input.slice(valueStart, valueEnd).trim();
      
      // Don't quote numbers, booleans, or null
      if (/^(true|false|null|\d+(\.\d+)?)$/i.test(value)) {
        result += value;
      } else if (value.length > 0) {
        // Quote the value and escape any internal quotes
        result += `"${value.replace(/"/g, '\\"')}"`;
      }
      
      i = valueEnd;
    } else {
      result += input[i];
      i++;
    }
  }
  
  return result;
}

