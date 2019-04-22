const mosodium = require('../mosodium')
const { AsyncClass } = require('../n3h-common')

const { Encoding } = require('@holochain/hcid-js')
const hck0 = new Encoding('hck0')

class TransitEncryption extends AsyncClass {
  async init () {
    await super.init()

    this._kxPub = await mosodium.SecBuf.insecure(mosodium.kx.PUBLICKEY_BYTES)
    this._kxPriv = await mosodium.SecBuf.secure(mosodium.kx.SECRETKEY_BYTES)

    await mosodium.kx.kxKeypair(this._kxPub, this._kxPriv)

    this._kxPub.readable(r => {
      this._kxPubId = hck0.encode(r)
    })

    this.$pushDestructor(async () => {
      await Promise.all([
        this._kxPub.destroy(),
        this._kxPriv.destroy()
      ])
      this._kxPub = null
      this._kxPubId = null
      this._kxPriv = null
    })
  }

  getPubKey () {
    return this._kxPubId
  }

  async createIntroduction (destPubKey) {
    const othPub = await mosodium.SecBuf.insecureFrom(
      hck0.decode(destPubKey), 0, mosodium.kx.PUBLICKEY_BYTES)

    const rx = await mosodium.SecBuf.secure(mosodium.kx.SESSIONKEY_BYTES)
    const tx = await mosodium.SecBuf.secure(mosodium.kx.SESSIONKEY_BYTES)
    await mosodium.kx.kxClientSession(rx, tx, this._kxPub, this._kxPriv, othPub)

    const session = await mosodium.SecBuf.secure(mosodium.aead.KEY_BYTES)
    await session.randomize()
  }

  async acceptIntroduction (buffer) {
  }
}

exports.TransitEncryption = TransitEncryption
