const { expect } = require('chai')

const mosodium = require('../mosodium')
mosodium.SecBuf.setLockLevel(mosodium.SecBuf.LOCK_NONE)

const { KeyBundle } = require('./index')
const util = require('./util')

const seed0 = new mosodium.SecBuf(32)
const seed1 = new mosodium.SecBuf(32)
seed1.writable(w => {
  w.writeUInt8(1, 0)
})
const seed2 = new mosodium.SecBuf(32)
seed2.writable(w => {
  w.writeUInt8(2, 0)
})

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
    expect(bundle0.getId()).equals('HcSCIp5KE88N7OwefwsKhKgRfJyr465fgikyphqCIpudwrcivgfWuxSju9mecor')
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
      // console.log('got error', e)
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
      // console.log('got error', e)
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should sign & verify', async () => {
    const sig = bundle0.sign(Buffer.from('hello'))
    expect(bundle0.verify(sig, Buffer.from('hello'))).equals(true)
  })

  it('should encrypt & decrypt', async () => {
    const cipher = bundle0.encrypt([
      bundle1.getEncId()
      //, bundle2.getEncId()
    ], Buffer.from('hello'))

    // expect(cipher.byteLength).equals(202)

    const res1 = bundle1.decrypt(bundle0.getEncId(), cipher)
    expect(res1.toString()).equals('hello')

    // const res2 = bundle2.decrypt(bundle0.getEncId(), cipher)
    // expect(res2.toString()).equals('hello')
  })

  it('others should not be able to decrypt', async () => {
    const cipher = bundle0.encrypt([
      bundle1.getEncId()
    ], Buffer.from('hello'))

    expect(cipher.byteLength).equals(126)

    try {
      bundle2.decrypt(bundle0.getEncId(), cipher)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should blob / unblob', async () => {
    const b = await bundle0.getBlob(mosodium.SecBuf.from(Buffer.from('hello')), 'hola')
    expect(b.hint).equals('hola')
    expect(b.type).equals('hcKeyBundle')
    const kp2 = await KeyBundle.fromBlob(
      b, mosodium.SecBuf.from(Buffer.from('hello')))
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
      p.sign(Buffer.from('hello'))
    } catch (e) {
      await p.destroy()
      return
    }
    await p.destroy()
    throw new Error('expected exception, got success')
  })
})
