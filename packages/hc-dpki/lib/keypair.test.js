const { expect } = require('chai')

const mosodium = require('@holochain/mosodium')
mosodium.SecBuf.setLockLevel(mosodium.SecBuf.LOCK_NONE)

const { Keypair } = require('./index')

const seed0 = new mosodium.SecBuf(32)
const seed1 = new mosodium.SecBuf(32)
seed1.writable(w => {
  w.writeUInt8(1, 0)
})
const seed2 = new mosodium.SecBuf(32)
seed2.writable(w => {
  w.writeUInt8(2, 0)
})

describe('keypair Suite', () => {
  let pair0 = null
  let pair1 = null
  let pair2 = null

  beforeEach(async () => {
    await Promise.all([
      (async () => {
        pair0 = await Keypair.newFromSeed(seed0)
      })(),
      (async () => {
        pair1 = await Keypair.newFromSeed(seed1)
      })(),
      (async () => {
        pair2 = await Keypair.newFromSeed(seed2)
      })()
    ])
  })

  afterEach(async () => {
    await Promise.all([
      pair0.destroy(),
      pair1.destroy(),
      pair2.destroy()
    ])
  })

  it('should gen a keypair', async () => {
    expect(pair0.getId()).equals('O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ilVfiPXNG8hPsWiNxOyokl-7zU1TVtSCIrGpZk6X9sJHt4m')
  })

  it('should throw on bad opt', async () => {
    try {
      await new Keypair()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad signPriv', async () => {
    try {
      await new Keypair({
        pubkeys: 'O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ilVfiPXNG8hPsWiNxOyokl-7zU1TVtSCIrGpZk6X9sJHt4m',
        signPriv: 32
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad encPriv', async () => {
    try {
      await new Keypair({
        pubkeys: 'O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ilVfiPXNG8hPsWiNxOyokl-7zU1TVtSCIrGpZk6X9sJHt4m',
        encPriv: 32
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad pubkeys', async () => {
    try {
      await new Keypair({
        pubkeys: 'O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ilVfiPXNG8hPsWiNxOyokl-7zU1TVtSCIrGpZk6X9sJHt4n'
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should sign / verify', async () => {
    const sig = pair0.sign(Buffer.from('hello'))
    expect(pair0.verify(sig, Buffer.from('hello'))).equals(true)
  })

  it('should enc / dec', async () => {
    const cipher = pair0.encrypt([
      pair1.getId(),
      pair2.getId()
    ], Buffer.from('hello'))

    expect(cipher.byteLength).equals(202)

    const res1 = pair1.decrypt(pair0.getId(), cipher)
    expect(res1.toString()).equals('hello')

    const res2 = pair2.decrypt(pair0.getId(), cipher)
    expect(res2.toString()).equals('hello')
  })

  it('others should not be able to decrypt', async () => {
    const cipher = pair0.encrypt([
      pair1.getId()
    ], Buffer.from('hello'))

    expect(cipher.byteLength).equals(126)

    try {
      pair2.decrypt(pair0.getId(), cipher)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should bundle / restore', async () => {
    const b = await pair0.getBundle(mosodium.SecBuf.from(Buffer.from('hello')), 'hola')
    expect(b.hint).equals('hola')
    expect(b.type).equals('hcKeypair')
    const kp2 = await Keypair.fromBundle(
      b, mosodium.SecBuf.from(Buffer.from('hello')))
    expect(kp2.getId()).equals(pair0.getId())
    await kp2.destroy()
  })

  it('should throw on no bundle hint', async () => {
    try {
      await pair0.getBundle(mosodium.SecBuf.from(Buffer.from('hello')))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on sign with no signpriv', async () => {
    const p = await new Keypair({
      pubkeys: 'O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ilVfiPXNG8hPsWiNxOyokl-7zU1TVtSCIrGpZk6X9sJHt4m'
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
