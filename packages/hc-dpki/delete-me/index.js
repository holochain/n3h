#!/usr/bin/env node

const perry = require('./perry')
const hid = require('./hid')

const v0hex = '389424'
const v0pre = '101'
const testHex = [
  [
    '0c71db50d35d760b0ea2002ff20147c7c3a8e8030d35ef28ed1adaec9e329aba',
    'HcKciDds5OiogymxbnHKEabQ8iavqs8dwdVaGdJW76Vp4gx47tQDfGW4OWc9w5i'
  ],
  [
    '0eed236f64da1df5b99f7bb5c64226b834a4fb40fc17cec4eed1a7d94def4a0a',
    ''
  ]
]

//perry.main()

console.log('--')
console.log('t', testHex[0][1])

const pres = perry.hexToBase32(testHex[0][0], v0hex, v0pre)
console.log('p', pres)

const hres = hid.hck0.encode(Buffer.from(testHex[0][0], 'hex'))
console.log('h', hres)

if (pres !== hres || pres !== testHex[0][1]) {
  console.log('not equal')
}

console.log('--')
console.log('t', testHex[0][0])

const pres2 = perry.base32ToHex(testHex[0][1])
console.log('p', pres2)

const hres2 = hid.hck0.decode(testHex[0][1]).toString('hex')
console.log('h', hres2)

if (pres2 !== hres2 || pres2 !== testHex[0][0]) {
  console.log('not equal')
}

console.log('--')
