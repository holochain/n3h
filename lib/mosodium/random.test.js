const expect = require('chai').expect
const mosodium = require('./index')

describe('random Suite', () => {
  it('should random buffer', async () => {
    const b1 = (await mosodium.random.randomBytes(32)).toString('hex')
    const b2 = (await mosodium.random.randomBytes(32)).toString('hex')
    expect(b1).not.equals(b2)
    expect(b1).not.equals('0000000000000000000000000000000000000000000000000000000000000000')
  })
})
