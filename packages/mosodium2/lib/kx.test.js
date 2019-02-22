const expect = require('chai').expect
const mosodium = require('./index')

describe('kx Suite', () => {
  /*
  it('should generate keypair', async () => {
    const { publicKey, secretKey } = sodium.kx.keypair()
    expect(publicKey.byteLength).equals(32)
    expect(secretKey._.byteLength).equals(32)
    secretKey.free()
  })
  */

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

  /*
  it('should throw on bad seedKeypair seed', () => {
    expect(() => {
      sodium.kx.seedKeypair()
    }).throws()
  })

  it('should throw on bad clientsession cliPublic', () => {
    expect(() => {
      sodium.kx.clientSession()
    }).throws()
  })

  it('should throw on bad clientsession srvPublic', () => {
    expect(() => {
      sodium.kx.clientSession(Buffer.alloc(0), new sodium.SecBuf(1))
    }).throws()
  })

  it('should throw on bad clientsession cliSecret', () => {
    expect(() => {
      sodium.kx.clientSession(Buffer.alloc(0), 'hi', Buffer.alloc(0))
    }).throws()
  })

  it('should throw on bad serversession srvPublic', () => {
    expect(() => {
      sodium.kx.serverSession()
    }).throws()
  })

  it('should throw on bad serversession cliPublic', () => {
    expect(() => {
      sodium.kx.serverSession(Buffer.alloc(0), new sodium.SecBuf(1))
    }).throws()
  })

  it('should throw on bad serversession srvSecret', () => {
    expect(() => {
      sodium.kx.serverSession(Buffer.alloc(0), 'hi', Buffer.alloc(0))
    }).throws()
  })

  */
})
