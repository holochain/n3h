const expect = require('chai').expect
const sodium = require('./index')

describe('aead Suite', () => {
  it('should fail with bad enc message', async () => {
    try {
      await sodium.aead.enc()
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad enc secret', async () => {
    try {
      await sodium.aead.enc(Buffer.alloc(0))
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad enc adata', async () => {
    try {
      await sodium.aead.enc(Buffer.alloc(0), await sodium.SecBuf.secure(1), 'hello')
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad dec nonce', async () => {
    try {
      await sodium.aead.dec()
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad dec cipher', async () => {
    try {
      await sodium.aead.dec(Buffer.alloc(0))
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad dec secret', async () => {
    try {
      await sodium.aead.dec(Buffer.alloc(0), Buffer.alloc(0))
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad dec adata', async () => {
    try {
      await sodium.aead.dec(
        Buffer.alloc(0), Buffer.alloc(0), await sodium.SecBuf.secure(1), 'hello')
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should encrypt and decrypt', async () => {
    const secret = await sodium.SecBuf.secure(32)
    await secret.randomize()

    const { nonce, cipher } = await sodium.aead.enc(Buffer.from('hello'), secret)

    let message = await sodium.aead.dec(nonce, cipher, secret)
    message = message.toString()

    secret.destroy()

    expect(message).equals('hello')
  })

  it('should encrypt and decrypt with auth aead', async () => {
    const secret = await sodium.SecBuf.secure(32)
    await secret.randomize()

    const { nonce, cipher } = await sodium.aead.enc(
      Buffer.from('hello'), secret, Buffer.from('aead'))

    let message = await sodium.aead.dec(nonce, cipher, secret, Buffer.from('aead'))
    message = message.toString()

    secret.destroy()

    expect(message).equals('hello')
  })

  it('should fail with bad aead', async () => {
    const secret = await sodium.SecBuf.secure(32)
    await secret.randomize()

    const { nonce, cipher } = await sodium.aead.enc(
      Buffer.from('hello'), secret, Buffer.from('aead'))

    try {
      await sodium.aead.dec(nonce, cipher, secret, Buffer.from('aead-bad'))
    } catch (e) {
      secret.destroy()
      return
    }
    throw new Error('expected exception, got success')
  })
})
