const expect = require('chai').expect
const sodium = require('./index')

function unsecret (secbuf, free) {
  let out = ''
  secbuf.readable((_secbuf) => {
    out = _secbuf.toString('base64')
  })
  if (free) {
    secbuf.free()
  }
  return out
}

describe('kx Suite', () => {
  before(() => {
    sodium.SecBuf.setLockLevel(sodium.SecBuf.LOCK_NONE)
  })

  it('should generate keypair', () => {
    const { publicKey, secretKey } = sodium.kx.keypair()
    expect(publicKey.byteLength).equals(32)
    expect(secretKey._.byteLength).equals(32)
    secretKey.free()
  })

  it('should generate keypair from seed', () => {
    const seed = new sodium.SecBuf(32)
    const { publicKey, secretKey } = sodium.kx.seedKeypair(seed)
    expect(secretKey.size()).equals(32)
    expect(publicKey.toString('base64')).equals('VX4j1zRvIT7FojcTsqJJfu81NU1bUgiKxqWZOl/bCR4=')
    seed.free()
    secretKey.free()
  })

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

  it('should keyexchange', () => {
    const { publicKey: cliPub, secretKey: cliSec } =
      sodium.kx.keypair()
    const { publicKey: srvPub, secretKey: srvSec } =
      sodium.kx.keypair()

    let { rx: cliRx, tx: cliTx } =
      sodium.kx.clientSession(cliPub, cliSec, srvPub)
    let { rx: srvRx, tx: srvTx } =
      sodium.kx.serverSession(srvPub, srvSec, cliPub)

    cliSec.free()
    srvSec.free()

    cliRx = unsecret(cliRx, true)
    cliTx = unsecret(cliTx, true)
    srvRx = unsecret(srvRx, true)
    srvTx = unsecret(srvTx, true)

    expect(cliRx).equals(srvTx)
    expect(cliTx).equals(srvRx)
  })
})
