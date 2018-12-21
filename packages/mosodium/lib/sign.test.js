const expect = require('chai').expect
const sodium = require('./index')

describe('sign Suite', () => {
  before(() => {
    sodium.SecBuf.setLockLevel(sodium.SecBuf.LOCK_NONE)
  })

  it('should throw on bad seedKeypair seed', () => {
    expect(() => {
      sodium.sign.seedKeypair()
    }).throws()
  })

  it('should throw on bad sign message', () => {
    expect(() => {
      sodium.sign.sign()
    }).throws()
  })

  it('should throw on bad sign secretKey', () => {
    expect(() => {
      sodium.sign.sign(Buffer.alloc(0))
    }).throws()
  })

  it('should throw on bad verify signature', () => {
    expect(() => {
      sodium.sign.verify()
    }).throws()
  })

  it('should throw on bad verify message', () => {
    expect(() => {
      sodium.sign.verify(Buffer.alloc(0))
    }).throws()
  })

  it('should throw on bad verify publicKey', () => {
    expect(() => {
      sodium.sign.verify(Buffer.alloc(0), Buffer.alloc(0))
    }).throws()
  })

  it('should sign and verify', () => {
    const seed = new sodium.SecBuf(32)
    seed.randomize()

    const { publicKey, secretKey } = sodium.sign.seedKeypair(seed)

    seed.free()

    const sig = sodium.sign.sign(Buffer.from('hello'), secretKey)
    const ver = sodium.sign.verify(sig, Buffer.from('hello'), publicKey)

    secretKey.free()

    expect(ver).equals(true)
  })

  it('should get false on bad verify', () => {
    const seed = new sodium.SecBuf(32)
    seed.randomize()

    const { publicKey, secretKey } = sodium.sign.seedKeypair(seed)

    seed.free()

    const sig = sodium.sign.sign(Buffer.from('hello'), secretKey)
    const ver = sodium.sign.verify(sig, Buffer.from('hello1'), publicKey)

    secretKey.free()

    expect(ver).equals(false)
  })
})
