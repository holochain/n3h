const expect = require('chai').expect
const mosodium = require('./index')

describe('sign Suite', () => {
  it('should sign and verify full', async () => {
    const [ seed, publicKey, secretKey, sig ] = await Promise.all([
      mosodium.SecBuf.insecure(mosodium.sign.SEED_BYTES),
      mosodium.SecBuf.insecure(mosodium.sign.PUBLICKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.sign.SECRETKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.sign.SIG_BYTES)
    ])

    await mosodium.random.randomBuffer(seed)

    await mosodium.sign.signSeedKeypair(publicKey, secretKey, seed)

    await seed.destroy()

    await mosodium.sign.signSign(sig, Buffer.from('hello'), secretKey)

    await secretKey.destroy()

    const ver = await mosodium.sign.signVerify(
      sig, Buffer.from('hello'), publicKey)

    await Promise.all([
      publicKey.destroy(),
      sig.destroy()
    ])

    expect(ver).equals(true)
  })

  it('should verify true', async () => {
    const ver = await mosodium.sign.signVerify(
      Buffer.from('/w6uKZ1a7uypsFWsu2kXnP5lHTR1FmJCfpSd5B0Sk7ewbs98KjiE9/olDJd7gCtpETKtAbLgSuhz/d/T/b87DQ==', 'base64'),
      Buffer.from('hello'),
      Buffer.from('vc60E570jXyT3RaKxNB9zZXual4/mhhJLN0WvnPAAKM=', 'base64')
    )

    expect(ver).equals(true)
  })

  it('should verify false', async () => {
    const ver = await mosodium.sign.signVerify(
      Buffer.from('/w6uKZ1a7uypsFWsu2kXnP5lHTR1FmJCfpSd5B0Sk7ewbs98KjiE9/olDJd7gCtpETKtAbLgSuhz/d/T/b87DQ==', 'base64'),
      Buffer.from('hello1'),
      Buffer.from('vc60E570jXyT3RaKxNB9zZXual4/mhhJLN0WvnPAAKM=', 'base64')
    )

    expect(ver).equals(false)
  })

  it('should throw on bad seedKeypair seed', async () => {
    try {
      await mosodium.sign.signSeedKeypair()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad sign message', async () => {
    try {
      await mosodium.sign.sign()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad sign secretKey', async () => {
    try {
      await mosodium.sign.sign(Buffer.alloc(0))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad verify signature', async () => {
    try {
      await mosodium.sign.verify()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad verify message', async () => {
    try {
      await mosodium.sign.verify(Buffer.alloc(0))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad verify publicKey', async () => {
    try {
      await mosodium.sign.verify(Buffer.alloc(0), Buffer.alloc(0))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

})
