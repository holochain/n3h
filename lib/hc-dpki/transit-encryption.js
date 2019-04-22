const mosodium = require('../mosodium')
const { AsyncClass } = require('../n3h-common')

const { Encoding } = require('@holochain/hcid-js')
const hck0 = new Encoding('hck0')

const msgpack = require('msgpack-lite')

/**
 */
class TransitEncryption extends AsyncClass {
  /**
   */
  async init () {
    await super.init()

    this._remote = new Map()

    this._kxPub = Buffer.alloc(mosodium.kx.PUBLICKEY_BYTES)
    this._kxPriv = await mosodium.SecBuf.secure(mosodium.kx.SECRETKEY_BYTES)

    await mosodium.kx.kxKeypair(this._kxPub, this._kxPriv)

    this._kxPubId = hck0.encode(this._kxPub)

    this.$pushDestructor(async () => {
      for (let ref of this._remote.values()) {
        await ref.reliableNonceTx.destroy()
        await ref.unreliableNonceTx.destroy()
        await ref.reliableNonceRx.destroy()
        await ref.unreliableNonceRx.destroy()
        if (ref.sessionTx) {
          await ref.sessionTx.destroy()
        }
        if (ref.sessionRx) {
          await ref.sessionRx.destroy()
        }
        if (ref.rx) {
          await ref.rx.destroy()
        }
      }

      this._remote.clear()
      this._remote = null

      await Promise.all([
        this._kxPriv.destroy()
      ])
      this._kxPub = null
      this._kxPubId = null
      this._kxPriv = null
    })
  }

  /**
   */
  getPubKey () {
    return this._kxPubId
  }

  /**
   */
  async handshakeStep1 (remoteId) {
    const othPub = Buffer.from(hck0.decode(remoteId))

    const rx = await mosodium.SecBuf.secure(mosodium.kx.SESSIONKEY_BYTES)
    const tx = await mosodium.SecBuf.secure(mosodium.kx.SESSIONKEY_BYTES)
    await mosodium.kx.kxClientSession(rx, tx, this._kxPub, this._kxPriv, othPub)

    const sessionTx = await mosodium.SecBuf.secure(mosodium.aead.KEY_BYTES)
    await sessionTx.randomize()

    const ref = await this._getRemoteRef(remoteId)
    ref.rx = rx
    ref.sessionTx = sessionTx

    const nonce = await mosodium.random.randomBytes(mosodium.aead.NONCE_BYTES)

    const cipher = await mosodium.aead.aeadEnc(nonce, sessionTx, tx, null)
    await tx.destroy()

    return Buffer.concat([nonce, cipher])
  }

  /**
   */
  async handshakeStep2 (remoteId, buffer) {
    const othPub = Buffer.from(hck0.decode(remoteId))

    let offset = 0
    const nonce = buffer.slice(offset, offset + mosodium.aead.NONCE_BYTES)
    offset += mosodium.aead.NONCE_BYTES
    const cipher = buffer.slice(offset)

    const rx = await mosodium.SecBuf.secure(mosodium.kx.SESSIONKEY_BYTES)
    const tx = await mosodium.SecBuf.secure(mosodium.kx.SESSIONKEY_BYTES)
    await mosodium.kx.kxServerSession(rx, tx, this._kxPub, this._kxPriv, othPub)

    const sessionRx = await mosodium.SecBuf.secure(mosodium.aead.KEY_BYTES)
    await mosodium.aead.aeadDec(sessionRx, nonce, cipher, rx, null)
    await rx.destroy()

    const sessionTx = await mosodium.SecBuf.secure(mosodium.aead.KEY_BYTES)
    await sessionTx.randomize()

    const ref = await this._getRemoteRef(remoteId)
    ref.sessionTx = sessionTx
    ref.sessionRx = sessionRx

    const rNonce = await mosodium.random.randomBytes(mosodium.aead.NONCE_BYTES)

    const rCipher = await mosodium.aead.aeadEnc(rNonce, sessionTx, tx, null)
    await tx.destroy()

    return Buffer.concat([rNonce, rCipher])
  }

  /**
   */
  async handshakeStep3 (remoteId, buffer) {
    if (!this._remote.has(remoteId)) {
      throw new Error('we are not handshaking with ' + remoteId)
    }

    let offset = 0
    const nonce = buffer.slice(offset, offset + mosodium.aead.NONCE_BYTES)
    offset += mosodium.aead.NONCE_BYTES
    const cipher = buffer.slice(offset)

    const ref = await this._getRemoteRef(remoteId)

    const sessionRx = await mosodium.SecBuf.secure(mosodium.aead.KEY_BYTES)
    await mosodium.aead.aeadDec(sessionRx, nonce, cipher, ref.rx, null)

    await ref.rx.destroy()
    delete ref.rx
    ref.sessionRx = sessionRx
  }

  /**
   */
  async sendReliable (remoteIdList, data) {
    const msgKey = await mosodium.SecBuf.secure(mosodium.aead.KEY_BYTES)
    try {
      await msgKey.randomize()

      const recip = [
        await mosodium.aead.aeadEnc(
          Buffer.alloc(mosodium.aead.NONCE_BYTES), data, msgKey, null)
      ]

      for (let remoteId of remoteIdList) {
        if (!this._remote.has(remoteId)) {
          throw new Error('no handshake with ' + remoteId)
        }
        const ref = await this._getRemoteRef(remoteId)
        const nonce = await ref.reliableNonceTx.toBuffer()
        ref.reliableNonceTx.increment()

        recip.push(await mosodium.aead.aeadEnc(
          nonce, msgKey, ref.sessionTx, null))
      }

      return msgpack.encode(recip)
    } finally {
      await msgKey.destroy()
    }
  }

  /**
   */
  async receiveReliable (buffer) {
    const msgKey = await mosodium.SecBuf.secure(mosodium.aead.KEY_BYTES)

    try {
      const recipList = msgpack.decode(buffer)
      const cipher = recipList.shift()

      let success = false

      top: for (let recip of recipList) { // eslint-disable-line no-labels
        for (let ref of this._remote.values()) {
          try {
            await mosodium.aead.aeadDec(
              msgKey, ref.reliableNonceRx, recip, ref.sessionRx, null)
            ref.reliableNonceRx.increment()
            success = true
            break top // eslint-disable-line no-labels
          } catch (e) { /* pass */ }
        }
      }

      if (!success) {
        throw new Error('could not decrypt')
      }

      const msg = Buffer.alloc(cipher.byteLength - mosodium.aead.A_BYTES)
      await mosodium.aead.aeadDec(
        msg, Buffer.alloc(mosodium.aead.NONCE_BYTES), cipher, msgKey, null)

      return msg
    } finally {
      await msgKey.destroy()
    }
  }

  /**
   */
  async sendUnreliable (remoteIdList, data) {
    const msgKey = await mosodium.SecBuf.secure(mosodium.aead.KEY_BYTES)
    try {
      await msgKey.randomize()

      const recip = [
        await mosodium.aead.aeadEnc(
          Buffer.alloc(mosodium.aead.NONCE_BYTES), data, msgKey, null)
      ]

      for (let remoteId of remoteIdList) {
        if (!this._remote.has(remoteId)) {
          throw new Error('no handshake with ' + remoteId)
        }
        const ref = await this._getRemoteRef(remoteId)
        const nonce = await ref.unreliableNonceTx.toBuffer()
        ref.unreliableNonceTx.increment()

        recip.push(nonce)
        recip.push(await mosodium.aead.aeadEnc(
          nonce, msgKey, ref.sessionTx, null))
      }

      return msgpack.encode(recip)
    } finally {
      await msgKey.destroy()
    }
  }

  /**
   */
  async receiveUnreliable (buffer) {
    const msgKey = await mosodium.SecBuf.secure(mosodium.aead.KEY_BYTES)

    try {
      const recipList = msgpack.decode(buffer)
      const cipher = recipList.shift()

      let success = false

      top: for (let i = 0; i < recipList.length; i += 2) { // eslint-disable-line no-labels
        const nonce = recipList[i]
        const recip = recipList[i + 1]
        for (let ref of this._remote.values()) {
          try {
            await mosodium.aead.aeadDec(
              msgKey, nonce, recip, ref.sessionRx, null)
            const ndif = await ref.reliableNonceRx.compare(nonce)
            if (ndif >= 0) {
              throw new Error('Unreliable NONCE too low. You should ignore this message.')
            }
            ref.reliableNonceRx.write(0, nonce)
            success = true
            break top // eslint-disable-line no-labels
          } catch (e) { /* pass */ }
        }
      }

      if (!success) {
        throw new Error('could not decrypt')
      }

      const msg = Buffer.alloc(cipher.byteLength - mosodium.aead.A_BYTES)
      await mosodium.aead.aeadDec(
        msg, Buffer.alloc(mosodium.aead.NONCE_BYTES), cipher, msgKey, null)

      return msg
    } finally {
      await msgKey.destroy()
    }
  }

  // -- private -- //

  /**
   */
  async _getRemoteRef (remoteId) {
    if (!this._remote.has(remoteId)) {
      this._remote.set(remoteId, {
        reliableNonceTx: await mosodium.SecBuf.ref(Buffer.alloc(
          mosodium.aead.NONCE_BYTES)),
        unreliableNonceTx: await mosodium.SecBuf.ref(Buffer.from(
          '7f' + ''.padStart(mosodium.aead.NONCE_BYTES * 2 - 2, 'f'), 'hex')),
        reliableNonceRx: await mosodium.SecBuf.ref(Buffer.alloc(
          mosodium.aead.NONCE_BYTES)),
        unreliableNonceRx: await mosodium.SecBuf.ref(Buffer.from(
          '7f' + ''.padStart(mosodium.aead.NONCE_BYTES * 2 - 2, 'f'), 'hex'))
      })
    }
    return this._remote.get(remoteId)
  }
}

exports.TransitEncryption = TransitEncryption
