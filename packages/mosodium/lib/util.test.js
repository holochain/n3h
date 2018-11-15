const mosodium = require('./index')
const { expect } = require('chai')

describe('util Suite', () => {
  it('should increment', () => {
    const b = Buffer.from('1234', 'hex')
    mosodium.util.increment(b)
    expect(b.toString('hex')).equals('1334')
  })

  it('should compare equal', () => {
    expect(mosodium.util.compare(
      Buffer.from('1234', 'hex'),
      Buffer.from('1234', 'hex')
    )).equals(0)
  })

  it('should compare gt', () => {
    expect(mosodium.util.compare(
      Buffer.from('1334', 'hex'),
      Buffer.from('1234', 'hex')
    )).equals(1)
  })

  it('should compare equal', () => {
    expect(mosodium.util.compare(
      Buffer.from('1134', 'hex'),
      Buffer.from('1234', 'hex')
    )).equals(-1)
  })
})
