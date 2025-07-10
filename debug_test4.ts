// Test the floatFromCommaSeparated logic directly
function floatFromCommaSeparated(value: string): number | null {
  // Remove trailing dots and commas
  let cleaned = value.trim().replace(/[,.]$/g, '')
  console.log('After removing trailing:', cleaned)
  
  // Remove commas and currency symbols
  cleaned = cleaned.replace(/[$,]/g, '')
  console.log('After removing commas/currency:', cleaned)
  
  // Try to parse as number
  const parsed = parseFloat(cleaned)
  console.log('Parsed:', parsed)
  
  if (!isNaN(parsed)) {
    return parsed
  }
  
  return null
}

console.log('Result for "12,111":', floatFromCommaSeparated('12,111'))
console.log('Result for "12,111.123":', floatFromCommaSeparated('12,111.123'))
console.log('Result for "1/5":', floatFromCommaSeparated('1/5'))
