const msgpack = require('msgpack-lite')

const { AsyncClass } = require('../n3h-common')
const mosodium = require('../mosodium')

const util = require('./util')

/**
 * Represents two asymmetric cryptography keypairs
 * - a signing keypair
 * - an encryption keypair
 *
 * base32 encoded identity string (hcid) to represent the public sides
 *
 * can optionally be initialized without the private halves of the pairs
 */
class KeyBundle extends AsyncClass {
  /**
   * derive the pairs from a 32 byte seed buffer
   * @param {SecBuf} seed - the seed buffer
   */
  static async newFromSeed (seed) {
    const { publicKey: signPubKey, secretKey: signPriv } =
      mosodium.sign.seedKeypair(seed, seed.lockLevel())
    const { publicKey: encPubKey, secretKey: encPriv } =
      mosodium.kx.seedKeypair(seed, seed.lockLevel())
    const signPubId = util.encodeSign(signPubKey)
    const encPubId = util.encodeEnc(encPubKey)
    return new KeyBundle({
      signPubId,
      encPubId,
      signPriv,
      encPriv
    })
  }

  /**
   * initialize the pairs from an encrypted persistence blob
   * @param {object} blob - persistence info
   * @param {string} passphrase - decryption passphrase
   */
  static async fromBlob (blob, passphrase) {
    blob = msgpack.decode(await util.pwDec(
      Buffer.from(blob.data, 'base64'), passphrase))
    return new KeyBundle({
      signPubId: blob[0],
      encPubId: blob[1],
      signPriv: mosodium.SecBuf.from(blob[2]),
      encPriv: mosodium.SecBuf.from(blob[3])
    })
  }

  /**
   * KeyBundle constructor (you probably want one of the static functions above)
   * @param {object} opt
   * @param {string} opt.signPubId - the signing identity string
   * @param {string} [opt.encPubId] - the encrypting identity string
   * @param {SecBuf} [opt.signPriv] - private signature key
   * @param {SecBuf} [opt.encPriv] - private encryption key
   */
  async init (opt) {
    await super.init()
    // Check input
    if (typeof opt !== 'object') {
      throw new Error('opt must be an Object')
    }
    if (typeof opt.signPubId !== 'string') {
      throw new Error('opt.signPubId must be a base32 encoded public key (hcid)')
    }
    if (opt.encPubId && typeof opt.encPubId !== 'string') {
      throw new Error('if opt.encPubId is specified, it must be a base32 encoded public key (hcid)')
    }
    if (opt.signPriv && !(opt.signPriv instanceof mosodium.SecBuf)) {
      throw new Error('if opt.signPriv is specified, it must be a SecBuf')
    }
    if (opt.encPriv && !(opt.encPriv instanceof mosodium.SecBuf)) {
      throw new Error('if opt.encPriv is specified, it must be a SecBuf')
    }
    // Check validity of pub keys' encoding
    util.decodeSign(opt.signPubId)
    if (opt.encPubId) {
      util.decodeEnc(opt.encPubId)
    }
    // Done
    this._signPubId = opt.signPubId
    this._encPubId = opt.encPubId
    this._signPriv = opt.signPriv
    this._encPriv = opt.encPriv
  }

  /**
   * generate an encrypted persistence blob
   * @param {string} passphrase - the encryption passphrase
   * @param {string} hint - additional info / description for the blob
   */
  async getBlob (passphrase, hint) {
    if (typeof hint !== 'string') {
      throw new Error('hint must be a string')
    }

    this._signPriv.$makeReadable()
    this._encPriv.$makeReadable()
    const out = {
      type: 'hcKeyBundle',
      hint,
      data: (await util.pwEnc(msgpack.encode([
        this._signPubId, this._encPubId,
        this._signPriv._, this._encPriv._
      ]), passphrase))
    }
    this._signPriv.$restoreProtection()
    this._encPriv.$restoreProtection()

    return out
  }

  /**
   * get the identifier string
   * @return {string}
   */
  getId () {
    return this._signPubId
  }

  /**
   * get the identifier string
   * @return {string}
   */
  getEncId () {
    return this._encPubId
  }

  /**
   * sign some arbitrary data with the signing private key
   * @param {Buffer} data - the data to sign
   */
  sign (data) {
    if (!this._signPriv) {
      throw new Error('no signPriv - cannot sign data')
    }
    return mosodium.sign.sign(data, this._signPriv)
  }

  /**
   * verify data that was signed with our private signing key
   * @param {Buffer} signature
   * @param {Buffer} data
   */
  verify (signature, data) {
    return util.verify(signature, data, this._signPubId)
  }

  /**
   * encrypt arbitrary data to be readale by potentially multiple recipients
   * @param {array<string>} recipientIds - multiple recipient identifier strings
   * @param {Buffer} data - the data to encrypt
   * @return {Buffer}
   */
  encrypt (recipientEncIds, data) {
    const symSecret = new mosodium.SecBuf(32)
    symSecret.randomize()

    // we will call the encryptor (us) the "server"
    // and the recipients the "client"
    const out = []
    for (let recEncId of recipientEncIds) {
      const recEncPub = util.decodeEnc(recEncId)

      // XXX lru cache these so we don't have to re-gen every time?
      const { tx } = mosodium.kx.serverSession(
        util.decodeEnc(this._encPubId), this._encPriv, recEncPub)
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
   * attempt to decrypt the cipher buffer (assuming it was targeting us)
   * @param {string} sourceId - identifier string of who encrypted this data
   * @param {Buffer} cipher - the encrypted data
   * @return {Buffer} - the decrypted data
   */
  decrypt (sourceEncId, cipher) {
    cipher = msgpack.decode(cipher)
    const srcEncPub = util.decodeEnc(sourceEncId)

    // we will call the encryptor the "server"
    // and the recipient (us) the "client"
    // XXX cache?
    const { rx } = mosodium.kx.clientSession(
      util.decodeEnc(this._encPubId), this._encPriv, srcEncPub)

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

exports.KeyBundle = KeyBundle
