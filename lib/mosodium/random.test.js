const expect = require('chai').expect
const mosodium = require('./index')

describe('random Suite', () => {
  it('should random buffer', async () => {
    const b1 = await mosodium.SecBuf.insecure(32)
    const b2 = await mosodium.SecBuf.insecure(32)
    let b1r = null
    let b2r = null
    await b1.readable(r => { b1r = r.toString('hex') })
    await b2.readable(r => { b2r = r.toString('hex') })
    expect(b1r).equals(b2r)
    expect(b1r).equals('0000000000000000000000000000000000000000000000000000000000000000')
    await mosodium.random.randomBuffer(b1)
    await mosodium.random.randomBuffer(b2)
    await b1.readable(r => { b1r = r.toString('hex') })
    await b2.readable(r => { b2r = r.toString('hex') })
    expect(b1).not.equals(b2)
    expect(b1).not.equals('0000000000000000000000000000000000000000000000000000000000000000')
  })
})
