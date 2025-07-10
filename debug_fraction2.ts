// Test the full flow
function floatFromCommaSeparated(value: string): number | null {
  // Remove trailing dots and commas
  let cleaned = value.trim().replace(/[,.]$/g, '')
  console.log('floatFromCommaSeparated - cleaned:', cleaned)
  
  // Remove commas and currency symbols
  cleaned = cleaned.replace(/[$,]/g, '')
  console.log('floatFromCommaSeparated - after removing commas:', cleaned)
  
  // Try to parse as number
  const parsed = parseFloat(cleaned)
  console.log('floatFromCommaSeparated - parsed:', parsed)
  
  if (!isNaN(parsed)) {
    return parsed
  }
  
  return null
}

const input = '1/5'
console.log('Testing "1/5":')
console.log('floatFromCommaSeparated result:', floatFromCommaSeparated(input))
