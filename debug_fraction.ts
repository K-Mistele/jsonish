// Test fraction parsing
function floatFromMaybeFraction(value: string): number | null {
  const parts = value.split('/')
  console.log('Parts:', parts)
  if (parts.length !== 2) return null
  
  const numerator = parseFloat(parts[0].trim())
  const denominator = parseFloat(parts[1].trim())
  console.log('Numerator:', numerator, 'Denominator:', denominator)
  
  if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
    return null
  }
  
  return numerator / denominator
}

console.log('Result for "1/5":', floatFromMaybeFraction('1/5'))
console.log('Result for "1 / 5":', floatFromMaybeFraction('1 / 5'))
