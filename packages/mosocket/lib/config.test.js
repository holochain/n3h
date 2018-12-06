const expect = require('chai').expect

const config = require('./config')
const { SecBuf } = require('@holochain/mosodium')

describe('config Suite', () => {
  it('should be a function', () => {
    expect(typeof config).equals('function')
  })

  describe('default', () => {
    let c

    beforeEach(() => {
      c = config()
    })

    it('timeout.newConnection', () => {
      expect(typeof c.timeout.newConnection).equals('number')
    })

    it('keys.kx.publicKey', () => {
      expect(c.keys.kx.publicKey instanceof Buffer).equals(true)
    })

    it('keys.kx.secretKey', () => {
      expect(c.keys.kx.secretKey instanceof SecBuf).equals(true)
    })
  })
})
