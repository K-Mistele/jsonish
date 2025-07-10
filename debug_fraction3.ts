// Test the full flow for fraction
function floatFromCommaSeparated(value: string): number | null {
  // Remove trailing dots and commas
  let cleaned = value.trim().replace(/[,.]$/g, '')
  
  // Remove commas and currency symbols
  cleaned = cleaned.replace(/[$,]/g, '')
  
  // Check if the cleaned value is a valid number representation
  // This regex matches valid number formats (including decimals and scientific notation)
  const validNumberRegex = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/
  
  if (validNumberRegex.test(cleaned)) {
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed)) {
      return parsed
    }
  }
  
  // Try to extract number from text using regex
  // This regex matches numbers at the beginning of text or after whitespace
  const regex = /(?:^|[\s])([-+]?\$?(?:\d+(?:,\d+)*(?:\.\d+)?|\d+\.\d+|\d+|\.\d+)(?:e[-+]?\d+)?)/
  const match = value.match(regex)
  
  if (match) {
    const numberStr = match[1]
    const withoutCurrency = numberStr.replace(/^\$/, '')
    const withoutCommas = withoutCurrency.replace(/,/g, '')
    const extracted = parseFloat(withoutCommas)
    
    if (!isNaN(extracted)) {
      return extracted
    }
  }
  
  return null
}

const input = '1/5'
console.log('floatFromCommaSeparated("1/5"):', floatFromCommaSeparated(input))
console.log('Should be null to allow fraction parsing to take over')
