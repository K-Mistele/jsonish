// Test parseFloat behavior
const test1 = '12,111'
const test2 = '12,111.123'
const test3 = '1/5'

console.log('parseFloat("12,111"):', parseFloat(test1))
console.log('parseFloat("12,111.123"):', parseFloat(test2))
console.log('parseFloat("1/5"):', parseFloat(test3))
