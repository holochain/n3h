const msgpack = require('msgpack-lite')

const { AsyncClass } = require('n3h-common')
const mosodium = require('mosodium')

function genId (signPub, encPub) {
  const hash = mosodium.hash.sha256(Buffer.concat([signPub, encPub]))

  let c = hash.readInt16LE(0)
  for (let i = 2; i < 32; i += 2) {
    c = c ^ hash.readInt16LE(i)
  }

  const checksum = Buffer.alloc(2)
  checksum.writeInt16LE(c, 0)

  return Buffer.concat([signPub, encPub, checksum]).toString('base64')
}

exports.genId = genId

/**
 * Actually, more like 2 keypairs...
 */
class Keypair extends AsyncClass {
  /**
   */
  static async newFromSeed (seed) {
    const { publicKey: signPub, secretKey: signPriv } =
      mosodium.sign.seedKeypair(seed, seed.lockLevel())
    const { publicKey: encPub, secretKey: encPriv } =
      mosodium.kx.seedKeypair(seed, seed.lockLevel())
    const pubkeys = genId(signPub, encPub)
    return new Keypair({
      pubkeys,
      signPriv,
      encPriv
    })
  }

  /**
   */
  async init (opt) {
    await super.init()

    if (
      typeof opt !== 'object' ||
      typeof opt.pubkeys !== 'string'
    ) {
      throw new Error('opt.pubkeys must be a base64 encoded pubkey pair (sign / enc)')
    }

    if (opt.signPriv && !(opt.signPriv instanceof mosodium.SecBuf)) {
      throw new Error('if opt.signPriv is specified, it must be a SecBuf')
    }

    if (opt.encPriv && !(opt.encPriv instanceof mosodium.SecBuf)) {
      throw new Error('if opt.encPriv is specified, it must be a SecBuf')
    }

    this._pubkeys = Buffer.from(opt.pubkeys, 'base64')
    this._signPub = this._pubkeys.slice(0, 32)
    this._encPub = this._pubkeys.slice(32, 64)
    this._pubkeys = genId(this._signPub, this._encPub)

    if (this._pubkeys !== opt.pubkeys) {
      throw new Error('error parsing opt.pubkeys')
    }

    this._signPriv = opt.signPriv
    this._encPriv = opt.encPriv
  }

  /**
   */
  getId () {
    return this._pubkeys
  }

  /**
   */
  sign (data) {
    if (!this._signPriv) {
      throw new Error('no signPriv - cannot sign data')
    }
    return mosodium.sign.sign(data, this._signPriv)
  }

  /**
   */
  verify (signature, data) {
    return mosodium.sign.verify(signature, data, this._signPub)
  }

  /**
   */
  encrypt (recipientIds, data) {
    const symSecret = new mosodium.SecBuf(32)
    symSecret.randomize()

    // we will call the encryptor (us) the "server"
    // and the recipients the "client"
    const out = []
    for (let id of recipientIds) {
      const recipPub = Buffer.from(id, 'base64').slice(32, 64)
      // XXX lru cache these so we don't have to re-gen every time?
      const { tx } = mosodium.kx.serverSession(
        this._encPub, this._encPriv, recipPub)
      symSecret.readable(_ss => {
        const { nonce, cipher } = mosodium.aead.enc(
          _ss, tx)
        out.push(nonce)
        out.push(cipher)
      })
    }

    const { nonce, cipher } = mosodium.aead.enc(data, symSecret)
    out.push(nonce)
    out.push(cipher)

    return msgpack.encode(out)
  }

  /**
   */
  decrypt (sourceId, cipher) {
    cipher = msgpack.decode(cipher)
    sourceId = Buffer.from(sourceId, 'base64').slice(32, 64)

    // we will call the encryptor the "server"
    // and the recipient (us) the "client"
    // XXX cache?
    const { rx } = mosodium.kx.clientSession(
      this._encPub, this._encPriv, sourceId)

    let symSecret = null
    for (let i = 0; i < cipher.length - 2; i += 2) {
      const n = cipher[i]
      const c = cipher[i + 1]
      try {
        symSecret = mosodium.aead.dec(n, c, rx)
        symSecret = mosodium.SecBuf.from(symSecret)
      } catch (e) { /* pass */ }
    }

    if (!symSecret) {
      throw new Error('could not decrypt - not a recipient?')
    }

    return mosodium.aead.dec(
      cipher[cipher.length - 2], cipher[cipher.length - 1], symSecret)
  }
}

exports.Keypair = Keypair
