const expect = require('chai').expect
const mosodium = require('./index')

describe('kx Suite', () => {
  it('should generate keypair', async () => {
    const [
      sbPub,
      sbPriv
    ] = await Promise.all([
      mosodium.SecBuf.insecure(mosodium.kx.PUBLICKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.SECRETKEY_BYTES)
    ])
    await mosodium.kx.kxKeypair(sbPub, sbPriv)
    await sbPriv.destroy()
  })

  it('should generate keypair from seed', async () => {
    const [
      sbSeed,
      sbPub,
      sbPriv
    ] = await Promise.all([
      mosodium.SecBuf.insecure(mosodium.kx.SEED_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.PUBLICKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.SECRETKEY_BYTES)
    ])

    await mosodium.kx.kxSeedKeypair(sbPub, sbPriv, sbSeed)

    await mosodium.SecBuf.unlockMulti([
      [sbPub, 'readable'],
      [sbPriv, 'readable']
    ], async (_pub, _priv) => {
      expect(_pub.toString('base64')).equals('VX4j1zRvIT7FojcTsqJJfu81NU1bUgiKxqWZOl/bCR4=')
      expect(_priv.toString('base64')).equals('iesNaoppHa4s0V7QNpkxzgqUnsr6XD+T+BIYM2RuFcM=')
    })
  })

  it('should keyexchange', async () => {
    const [
      cliPub, cliSec,
      srvPub, srvSec,
      cliRx, cliTx,
      srvRx, srvTx
    ] = await Promise.all([
      mosodium.SecBuf.insecure(mosodium.kx.PUBLICKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.SECRETKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.PUBLICKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.SECRETKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.SESSIONKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.SESSIONKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.SESSIONKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.SESSIONKEY_BYTES)
    ])

    await Promise.all([
      mosodium.kx.kxKeypair(cliPub, cliSec),
      mosodium.kx.kxKeypair(srvPub, srvSec)
    ])

    await Promise.all([
      mosodium.kx.kxClientSession(cliRx, cliTx, cliPub, cliSec, srvPub),
      mosodium.kx.kxServerSession(srvRx, srvTx, srvPub, srvSec, cliPub)
    ])

    await mosodium.SecBuf.unlockMulti([
      [cliRx, 'readable'],
      [cliTx, 'readable'],
      [srvRx, 'readable'],
      [srvTx, 'readable']
    ], (_cliRx, _cliTx, _srvRx, _srvTx) => {
      expect(_cliRx.toString('hex')).equals(_srvTx.toString('hex'))
      expect(_cliTx.toString('hex')).equals(_srvRx.toString('hex'))
    })
  })

  it('should throw on bad seedKeypair seed', async () => {
    try {
      await mosodium.kx.kxSeedKeypair()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad clientSession cliPublic', async () => {
    try {
      await mosodium.kx.kxClientSession()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad clientSession srvPublic', async () => {
    const [rx, tx] = await Promise.all([
      mosodium.SecBuf.insecure(mosodium.kx.SESSIONKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.SESSIONKEY_BYTES)
    ])
    try {
      await mosodium.kx.kxClientSession(rx, tx, await mosodium.SecBuf.insecure(1))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad serversession srvPublic', async () => {
    try {
      await mosodium.kx.kxServerSession()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad serversession cliPublic', async () => {
    const [rx, tx] = await Promise.all([
      mosodium.SecBuf.insecure(mosodium.kx.SESSIONKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.SESSIONKEY_BYTES)
    ])
    try {
      await mosodium.kx.kxServerSession(rx, tx, await mosodium.SecBuf.insecure(1))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })
})
