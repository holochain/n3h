#!/usr/bin/env node

const perry = require('./perry')
const hid = require('./hid')

const v0hex = '389424'
const v0pre = '101'
const testHex = [
  '0c71db50d35d760b0ea2002ff20147c7c3a8e8030d35ef28ed1adaec9e329aba',
  '0eed236f64da1df5b99f7bb5c64226b834a4fb40fc17cec4eed1a7d94def4a0a'
]

//perry.main()

const pres = perry.hexToBase32(testHex[0], v0hex, v0pre)
const hres = hid.hck0.encode(Buffer.from(testHex[0], 'hex'))

console.log(pres)
console.log(hres)
if (pres !== hres) {
  console.log('not equal')
}

