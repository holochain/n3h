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
   * derive the keyBundle from a 32 byte seed buffer
   * @param {SecBuf} seed - the seed buffer
   * @return {KeyBundle}
   */
  static async newFromSeed (seed) {
    // Generate keypair buffers
    const [
      signPubKey, signPriv,
      encPubKey, encPriv
    ] = await Promise.all([
      mosodium.SecBuf.insecure(mosodium.sign.PUBLICKEY_BYTES),
      mosodium.SecBuf.secure(mosodium.sign.SECRETKEY_BYTES),
      mosodium.SecBuf.insecure(mosodium.kx.PUBLICKEY_BYTES),
      mosodium.SecBuf.secure(mosodium.kx.SECRETKEY_BYTES)
    ])

    // Generate keypairs
    await Promise.all([
      mosodium.sign.signSeedKeypair(signPubKey, signPriv, seed),
      mosodium.kx.kxSeedKeypair(encPubKey, encPriv, seed)
    ])

    // HCID encode pub keys
    let signPubId = null
    let encPubId = null
    await Promise.all([
      signPubKey.readable(b => {
        signPubId = util.encodeSign(b)
      }),
      encPubKey.readable(b => {
        encPubId = util.encodeEnc(b)
      })
    ])

    // Done
    return new KeyBundle({
      signPubId,
      encPubId,
      signPriv,
      encPriv
    })
  }

  /**
   * initialize the keyBundle from an encrypted persistence blob
   * @param {object} blob - persistence info
   * @param {string} passphrase - decryption passphrase
   * @return {KeyBundle}
   */
  static async fromBlob (blob, passphrase) {
    blob = msgpack.decode(await util.pwDec(Buffer.from(blob.data, 'base64'), passphrase))
    return new KeyBundle({
      signPubId: blob[0],
      encPubId: blob[1],
      signPriv: await mosodium.SecBuf.ref(blob[2]),
      encPriv: await mosodium.SecBuf.ref(blob[3])
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
   * generate an encrypted persistence blob of the keyBundle
   * @param {string} passphrase - the encryption passphrase
   * @param {string} hint - additional info / description for the blob
   * @return {Buffer} Object holding encrypted KeyBundle
   */
  async getBlob (passphrase, hint) {
    if (typeof hint !== 'string') {
      throw new Error('hint must be a string')
    }

    let pack = null
    await this._signPriv.readable(async (_sp) => {
      await this._encPriv.readable(async (_ep) => {
        pack = msgpack.encode([this._signPubId, this._encPubId, _sp, _ep])
      })
    })
    const cipher = await util.pwEnc(pack, passphrase)
    return {
      type: 'hcKeyBundle',
      hint,
      data: cipher.toString('base64')
    }
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
   * sign some data with the signing private key
   * @param {Buffer} data - the data to sign
   * @return {SecBuf} signature
   */
  async sign (data) {
    if (!this._signPriv) {
      throw new Error('no signPriv - cannot sign data')
    }
    const signature = await mosodium.SecBuf.insecure(mosodium.sign.SIG_BYTES)
    await mosodium.sign.signSign(signature, data, this._signPriv)
    return signature
  }

  /**
   * Return true if data was signed with our private signing key
   */
  async verify (signature, data) {
    return util.verify(signature, data, this._signPubId)
  }
}

exports.KeyBundle = KeyBundle
