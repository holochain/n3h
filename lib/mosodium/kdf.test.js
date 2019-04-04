const expect = require('chai').expect
const mosodium = require('./index')

describe('kdf Suite', () => {
  /*
  it('should throw on bad derive index', () => {
    expect(() => {
      sodium.kdf.derive('hi')
    }).throws()
  })

  it('should throw on bad derive context', () => {
    expect(() => {
      sodium.kdf.derive(3, Buffer.from([1]))
    }).throws()
  })

  it('should throw on bad derive parent', () => {
    expect(() => {
      sodium.kdf.derive(3, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))
    }).throws()
  })
  */

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
