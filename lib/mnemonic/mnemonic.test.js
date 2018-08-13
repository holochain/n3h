const expect = require('chai').expect

const mnemonic = require('./mnemonic')

describe('mnemonic Suite', () => {
  it('should generate consistantly', () => {
    expect(mnemonic.toMnemonic(Buffer.from([0, 256, 128, 33])))
      .deep.equals(['abandon', 'advice', 'analyst'])
  })

  it('should parse consistantly', () => {
    expect(
      mnemonic.fromMnemonic(['abandon', 'advice', 'analyst']).toString('base64')
    ).equals('AACAIQ==')
  })

  it('should throw on bad buffer len', () => {
    expect(() => {
      mnemonic.toMnemonic(Buffer.alloc(3))
    }).throws()
  })

  it('should throw on bad checksum', () => {
    expect(() => {
      mnemonic.fromMnemonic(['iron', 'advice', 'analyst'])
    }).throws()
  })
})
