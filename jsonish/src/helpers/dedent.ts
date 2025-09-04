interface DedentResult {
  content: string;
  indentSize: number;
}

export function dedent(input: string): string {
  const result = dedentWithInfo(input);
  return result.content;
}

export function dedentWithInfo(input: string): DedentResult {
  if (!input) return { content: '', indentSize: 0 };
  
  const lines = input.split('\n');
  
  // Remove leading and trailing empty lines for cleaner output
  let startIdx = 0;
  let endIdx = lines.length - 1;
  
  // Remove leading empty lines
  while (startIdx < lines.length && lines[startIdx].trim() === '') {
    startIdx++;
  }
  
  // Remove trailing empty lines
  while (endIdx >= 0 && lines[endIdx].trim() === '') {
    endIdx--;
  }
  
  // If all lines are empty, return empty string
  if (startIdx > endIdx) {
    return { content: '', indentSize: 0 };
  }
  
  const contentLines = lines.slice(startIdx, endIdx + 1);
  
  // Find common indentation
  let commonPrefix = '';
  if (contentLines.length > 0) {
    // Start with first line's indentation
    const firstLine = contentLines[0];
    commonPrefix = firstLine.match(/^[ \t]*/)?.[0] || '';
    
    // Refine by checking other non-empty lines
    for (let i = 1; i < contentLines.length; i++) {
      const line = contentLines[i];
      if (line.trim() === '') continue; // Skip empty lines
      
      const linePrefix = line.match(/^[ \t]*/)?.[0] || '';
      
      // Find common prefix between current and existing
      let j = 0;
      while (j < Math.min(commonPrefix.length, linePrefix.length) && 
             commonPrefix[j] === linePrefix[j]) {
        j++;
      }
      commonPrefix = commonPrefix.slice(0, j);
      
      if (commonPrefix === '') break; // No common indentation
    }
  }
  
  // Apply prefix removal
  const dedentedLines = contentLines.map(line => 
    line.length >= commonPrefix.length && line.startsWith(commonPrefix)
      ? line.slice(commonPrefix.length)
      : line
  );
  
  const result = dedentedLines.join('\n');
  
  return { 
    content: result,
    indentSize: commonPrefix.length
  };
}