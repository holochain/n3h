const expect = require('chai').expect
const sodium = require('./index')

describe('aead Suite', () => {
  it('should fail with bad enc message', async () => {
    try {
      await sodium.aead.aeadEnc()
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad enc secret', async () => {
    try {
      await sodium.aead.aeadEnc(Buffer.alloc(0))
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad enc adata', async () => {
    try {
      await sodium.aead.aeadEnc(Buffer.alloc(0), await sodium.SecBuf.secure(1), 'hello')
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad dec nonce', async () => {
    try {
      await sodium.aead.aeadDec()
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad dec cipher', async () => {
    try {
      await sodium.aead.aeadDec(Buffer.alloc(0))
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad dec secret', async () => {
    try {
      await sodium.aead.aeadDec(Buffer.alloc(0), Buffer.alloc(0))
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should fail with bad dec adata', async () => {
    try {
      await sodium.aead.aeadDec(
        Buffer.alloc(0), Buffer.alloc(0), await sodium.SecBuf.secure(1), 'hello')
    } catch (e) { return }
    throw new Error('expected exception, got success')
  })

  it('should encrypt and decrypt', async () => {
    const nonce = await sodium.random.randomBytes(sodium.aead.NONCE_BYTES)
    const secret = await sodium.SecBuf.secure(32)
    await secret.randomize()

    const cipher = await sodium.aead.aeadEnc(
      nonce, Buffer.from('hello'), secret)

    const message = await sodium.SecBuf.insecure(5)
    await sodium.aead.aeadDec(message, nonce, cipher, secret)

    await secret.destroy()

    await message.readable(async _m => {
      expect(_m.toString()).equals('hello')
    })

    await message.destroy()
  })

  it('should encrypt and decrypt with auth aead', async () => {
    const nonce = await sodium.random.randomBytes(sodium.aead.NONCE_BYTES)
    const secret = await sodium.SecBuf.secure(32)
    await secret.randomize()

    const cipher = await sodium.aead.aeadEnc(
      nonce, Buffer.from('hello'), secret, Buffer.from('aead'))

    const message = await sodium.SecBuf.insecure(5)
    await sodium.aead.aeadDec(
      message, nonce, cipher, secret, Buffer.from('aead'))

    await secret.destroy()

    await message.readable(async _m => {
      expect(_m.toString()).equals('hello')
    })

    await message.destroy()
  })

  it('should fail with bad aead', async () => {
    const nonce = await sodium.random.randomBytes(sodium.aead.NONCE_BYTES)
    const secret = await sodium.SecBuf.secure(32)
    await secret.randomize()

    const cipher = await sodium.aead.aeadEnc(
      nonce, Buffer.from('hello'), secret, Buffer.from('aead'))

    const message = await sodium.SecBuf.insecure(5)
    try {
      await sodium.aead.aeadDec(
        message, nonce, cipher, secret, Buffer.from('aead-bad'))
    } catch (e) {
      return
    } finally {
      await secret.destroy()
      await message.destroy()
    }
    throw new Error('expected exception, got success')
  })
})
