import { parseWithStateMachine } from './state-machine.js';
import { Value } from './value.js';

export function fixJson(input: string): string {
  let fixed = input.trim();
  
  
  // Handle triple-quoted strings: """content""" → "content"
  fixed = fixed.replace(/"""([\s\S]*?)"""/g, (match, content) => {
    return `"${content.replace(/"/g, '\\"')}"`;
  });
  
  // Fix numbers with commas: -2,000.00 → -2000.00
  fixed = fixCommaSeparatedNumbers(fixed);
  
  // Fix malformed arrays specifically
  fixed = fixArrayElements(fixed);
  
  // Fix unquoted string values (but not numbers/booleans) FIRST
  // This must come before key fixing to avoid corrupting function signatures
  fixed = fixComplexUnquotedValues(fixed);
  
  // Then fix unquoted keys: {key: "value"} → {"key": "value"}
  // But be more careful to only match actual object keys, not colons inside quoted strings
  fixed = fixUnquotedKeys(fixed);
  
  // Fix trailing commas in arrays: [1,2,3,] → [1,2,3]
  fixed = fixed.replace(/,\s*]/g, ']');
  
  // Fix trailing commas in objects: {"a":1,} → {"a":1}  
  fixed = fixed.replace(/,\s*}/g, '}');
  
  // Fix mixed escaped/unescaped quotes in string values
  fixed = fixMixedQuotes(fixed);
  
  // Auto-close missing brackets and quotes
  fixed = autoCloseBrackets(fixed);
  fixed = autoCloseQuotes(fixed);
  
  
  return fixed;
}

function fixCommaSeparatedNumbers(input: string): string {
  // Fix numbers with commas like -2,000.00 → -2000.00
  // Be careful not to affect commas that are JSON separators
  return input.replace(/(-?\d+(?:,\d{3})+(?:\.\d+)?)/g, (match) => {
    return match.replace(/,/g, '');
  });
}

function fixArrayElements(input: string): string {
  let result = input;
  
  // Fix unquoted array elements: [hello, world, test] → ["hello", "world", "test"]
  result = result.replace(/\[(.*?)\]/g, (match, contents) => {
    // Don't process if it looks like valid JSON already
    try {
      JSON.parse(match);
      return match; // Already valid, don't change
    } catch {
      // Continue with fixing
    }
    
    // Split by commas but preserve quoted strings
    const elements = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < contents.length; i++) {
      const char = contents[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar && (i === 0 || contents[i-1] !== '\\')) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (!inQuotes && char === ',') {
        elements.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      elements.push(current.trim());
    }
    
    // Quote unquoted elements and normalize quotes
    const fixedElements = elements.map(element => {
      element = element.trim();
      if (!element) return element;
      
      // Already properly quoted?
      if (element.startsWith('"') && element.endsWith('"')) {
        return element; // Keep as-is
      }
      
      // Single quoted? Normalize to double quotes
      if (element.startsWith("'") && element.endsWith("'")) {
        return `"${element.slice(1, -1).replace(/"/g, '\\"')}"`;
      }
      
      // Handle escaped quotes: ""a"" → "a"
      if (element.startsWith('""') && element.endsWith('""') && element.length >= 4) {
        return `"${element.slice(2, -2)}"`;
      }
      
      // Is it a number, boolean, or null?
      if (/^(true|false|null|\d+(\.\d+)?)$/i.test(element)) {
        return element.toLowerCase();
      }
      
      // Quote as string and escape internal quotes
      return `"${element.replace(/"/g, '\\"')}"`;
    });
    
    return `[${fixedElements.join(', ')}]`;
  });
  
  return result;
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
      
      // Check if the value is already quoted
      if (input[i] === '"' || input[i] === "'") {
        // Value is already quoted, don't modify it
        result += input[i];
      } else {
        // Check if we need to quote this unquoted value
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
        if (/^(true|false|null|-?\d+(?:\.\d+)?)$/i.test(value)) {
          result += value;
        } else if (value.length > 0) {
          // Quote the value and escape any internal quotes
          result += `"${value.replace(/"/g, '\\"')}"`;
        }
        
        i = valueEnd - 1; // -1 because the loop will increment
      }
    } else {
      result += input[i];
      i++;
    }
  }
  
  return result;
}

function fixMixedQuotes(input: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringStart = -1;
  let currentQuote = '';
  
  while (i < input.length) {
    const char = input[i];
    
    if (!inString) {
      if (char === '"' || char === "'") {
        // Start of a string
        inString = true;
        stringStart = i;
        currentQuote = char;
        result += char;
      } else {
        result += char;
      }
    } else {
      // We're inside a string
      if (char === '\\' && i + 1 < input.length) {
        // Properly escaped character, keep as is
        result += char + input[i + 1];
        i += 2;
        continue;
      } else if (char === currentQuote) {
        // Look ahead to see if this is likely the end of the string
        const nextChar = i + 1 < input.length ? input[i + 1] : '';
        const isStringEnd = nextChar === '' || nextChar === ',' || nextChar === '}' || nextChar === ']' || /\s/.test(nextChar);
        
        if (isStringEnd) {
          // This is the closing quote
          result += char;
          inString = false;
          stringStart = -1;
          currentQuote = '';
        } else {
          // This is an unescaped quote within the string, escape it
          result += '\\' + char;
        }
      } else {
        result += char;
      }
    }
    
    i++;
  }
  
  return result;
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