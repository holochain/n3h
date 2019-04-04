const expect = require('chai').expect
const sodium = require('./index')

describe('aead Suite', () => {

  it('should fail with bad enc message', () => {
    expect(() => {
      sodium.aead.enc()
    }).throws()
  })

  it('should fail with bad enc secret', () => {
    expect(() => {
      sodium.aead.enc(Buffer.alloc(0))
    }).throws()
  })

  it('should fail with bad enc adata', async () => {
    expect(() => {
      sodium.aead.enc(Buffer.alloc(0), await sodium.SecBuf.secure(1), 'hello')
    }).throws()
  })

  it('should fail with bad dec nonce', () => {
    expect(() => {
      sodium.aead.dec()
    }).throws()
  })

  it('should fail with bad dec cipher', () => {
    expect(() => {
      sodium.aead.dec(Buffer.alloc(0))
    }).throws()
  })

  it('should fail with bad dec secret', () => {
    expect(() => {
      sodium.aead.dec(Buffer.alloc(0), Buffer.alloc(0))
    }).throws()
  })

  it('should fail with bad dec adata', async () => {
    expect(() => {
      sodium.aead.dec(
        Buffer.alloc(0), Buffer.alloc(0), await sodium.SecBuf.secure(1), 'hello')
    }).throws()
  })

  it('should encrypt and decrypt', async () => {
    const secret = await sodium.SecBuf.secure(32)
    secret.randomize()

    const { nonce, cipher } = sodium.aead.enc(
      Buffer.from('hello'), secret)

    const message = sodium.aead.dec(nonce, cipher, secret).toString()

    secret.free()

    expect(message).equals('hello')
  })

  it('should encrypt and decrypt with auth aead', async () => {
    const secret = await sodium.SecBuf.secure(32)
    secret.randomize()

    const { nonce, cipher } = sodium.aead.enc(
      Buffer.from('hello'), secret, Buffer.from('aead'))

    const message = sodium.aead.dec(
      nonce, cipher, secret, Buffer.from('aead')).toString()

    secret.free()

    expect(message).equals('hello')
  })

  it('should fail with bad aead', async () => {
    const secret = await sodium.SecBuf.secure(32)
    secret.randomize()

    const { nonce, cipher } = sodium.aead.enc(
      Buffer.from('hello'), secret, Buffer.from('aead'))

    expect(() => {
      sodium.aead.dec(
        nonce, cipher, secret, Buffer.from('aead-bad')).toString()
    }).throws()

    secret.free()
  })
})
