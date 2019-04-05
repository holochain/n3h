const expect = require('chai').expect
const mosodium = require('./index')

describe('kdf Suite', () => {
  it('should throw on bad derive index', async () => {
    const [
      ctx,
      src,
      out
    ] = await Promise.all([
      mosodium.SecBuf.ref(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])),
      mosodium.SecBuf.ref(Buffer.from('drUpmsHbWiQWMJqcp64PeW5KuFBY20flF1cBsmJudo8=', 'base64')),
      mosodium.SecBuf.insecure(32)
    ])
    try {
      await mosodium.kdf.kdfDerive(out, 'hi', ctx, src)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad derive context', async () => {
    const [
      src,
      out
    ] = await Promise.all([
      mosodium.SecBuf.ref(Buffer.from('drUpmsHbWiQWMJqcp64PeW5KuFBY20flF1cBsmJudo8=', 'base64')),
      mosodium.SecBuf.insecure(32)
    ])
    try {
      await mosodium.kdf.kdfDerive(out, 3, Buffer.from([1]), src)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad derive parent', async () => {
    const [
      ctx,
      out
    ] = await Promise.all([
      mosodium.SecBuf.ref(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])),
      mosodium.SecBuf.insecure(32)
    ])
    try {
      await mosodium.kdf.kdfDerive(out, 3, ctx)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should derive consistantly', async () => {
    const [
      ctx,
      src,
      out
    ] = await Promise.all([
      mosodium.SecBuf.ref(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])),
      mosodium.SecBuf.ref(Buffer.from('drUpmsHbWiQWMJqcp64PeW5KuFBY20flF1cBsmJudo8=', 'base64')),
      mosodium.SecBuf.insecure(32)
    ])

    await mosodium.kdf.kdfDerive(out, 3, ctx, src)

    let res = null
    await out.readable(r => { res = r.toString('base64') })

    expect(res).equals('vKXCfGRIgJ9GsfJEG2+GeUsPtCMC0XVi/s0SaJeC/iU=')

    await Promise.all([
      ctx.destroy(),
      src.destroy(),
      out.destroy()
    ])
  })
})
