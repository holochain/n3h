const { expect } = require('chai')

const mosodium = require('../mosodium')

const { KeyBundle } = require('./index')
const util = require('./util')

describe('KeyBundle Suite', () => {
  let bundle0 = null
  let bundle1 = null
  let bundle2 = null

  let opstmp = null
  let memtmp = null

  beforeEach(async () => {
    opstmp = util.pwhashOpslimit
    util.pwhashOpslimit = mosodium.pwhash.OPSLIMIT_INTERACTIVE
    memtmp = util.pwhashMemlimit
    util.pwhashMemlimit = mosodium.pwhash.MEMLIMIT_INTERACTIVE

    const seed0 = await mosodium.SecBuf.secure(mosodium.sign.SEED_BYTES)
    const seed1 = await mosodium.SecBuf.secure(mosodium.sign.SEED_BYTES)
    const seed2 = await mosodium.SecBuf.secure(mosodium.sign.SEED_BYTES)

    await seed1.writable(w => {
      w.writeUInt8(1, 0)
    })
    await seed2.writable(w => {
      w.writeUInt8(2, 0)
    })

    await Promise.all([
      (async () => {
        bundle0 = await KeyBundle.newFromSeed(seed0)
      })(),
      (async () => {
        bundle1 = await KeyBundle.newFromSeed(seed1)
      })(),
      (async () => {
        bundle2 = await KeyBundle.newFromSeed(seed2)
      })()
    ])
  })

  afterEach(async () => {
    await Promise.all([
      bundle0.destroy(),
      bundle1.destroy(),
      bundle2.destroy()
    ])
    util.pwhashOpslimit = opstmp
    util.pwhashMemlimit = memtmp
  })

  it('should gen a KeyBundle', async () => {
    expect(bundle1.getId()).equals('HcSCI4TBGxB79R55us6SCVc7iyRn5imumRSOw765qNTg3dmnAZnw5QRpY5nrvdr')
  })

  it('should throw on bad opt', async () => {
    try {
      await new KeyBundle()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad signPriv', async () => {
    try {
      await new KeyBundle({
        signPubId: 'HcSCIp5KE88N7OwefwsKhKgRfJyr465fgikyphqCIpudwrcivgfWuxSju9mecor',
        signPriv: 32
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad encPriv', async () => {
    try {
      await new KeyBundle({
        signPubId: 'HcSCIp5KE88N7OwefwsKhKgRfJyr465fgikyphqCIpudwrcivgfWuxSju9mecor',
        encPriv: 32
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad signPubId', async () => {
    try {
      await new KeyBundle({
        signPubId: 'HcSCIp5KE88N7OwefwsKhKgAAAAAAAAfgikyphqCIpudwrcivgfWuxSju9mecor'
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad encPub', async () => {
    try {
      await new KeyBundle({
        signPubId: 'HcSCIp5KE88N7OwefwsKhKgRfJyr465fgikyphqCIpudwrcivgfWuxSju9mecor',
        encPubId: 'HcSCIp5KE88N7OwefwsKhKgRfAAAAAAAAAkyphqCIpudwrcivgfWuxSju9mecor'
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should sign & verify', async () => {
    const sig = await bundle0.sign(Buffer.from('hello'))
    expect(await bundle0.verify(sig, Buffer.from('hello'))).equals(true)
  })

  it('should blob / unblob', async () => {
    let passphrase = Buffer.from('hello')
    const b = await bundle0.getBlob(passphrase, 'hola')
    expect(b.hint).equals('hola')
    expect(b.type).equals('hcKeyBundle')
    const kp2 = await KeyBundle.fromBlob(b, passphrase)
    expect(kp2.getId()).equals(bundle0.getId())
    await kp2.destroy()
  })

  it('should throw on no blob hint', async () => {
    try {
      await bundle0.getBlob(mosodium.SecBuf.from(Buffer.from('hello')))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on sign with no signpriv', async () => {
    const p = await new KeyBundle({
      signPubId: 'HcSCIp5KE88N7OwefwsKhKgRfJyr465fgikyphqCIpudwrcivgfWuxSju9mecor'
    })
    try {
      await p.sign(Buffer.from('hello'))
    } catch (e) {
      await p.destroy()
      return
    }
    await p.destroy()
    throw new Error('expected exception, got success')
  })
})
