const sodium = require('sodium-native')

const { SecBuf } = require('./secbuf')

const NONCEBYTES = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
const ABYTES = sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES
// const KEYBYTES = sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES

/**
 * Generate symmetric cipher text given a message, secret, and optional auth data
 * @example
 * const cipher = mosodium.aead.enc(Buffer.from('hello'), secret)
 *
 * @param {Buffer} message - data to encrypt
 * @param {SecBuf} secret - symmetric secret key
 * @param {Buffer} adata - optional additional authenticated data
 * @return {object} - { nonce, cipher }
 */
exports.enc = async function aeadEnc (message, secret, adata) {
  if (!(message instanceof Buffer)) {
    throw new Error('message must be a Buffer')
  }
  if (!(secret instanceof SecBuf)) {
    throw new Error('secret must be a SecBuf')
  }
  if (adata && !(adata instanceof Buffer)) {
    throw new Error('if you supply adata, it must be a Buffer')
  }

  const nonce = await SecBuf.insecure(NONCEBYTES)
  await nonce.randomize()

  const cipher = Buffer.alloc(message.byteLength + ABYTES)
  let n = Buffer.alloc(NONCEBYTES)
  await secret.readable(async (_secret) => {
    await nonce.readable((_nonce) => {
      console.log('_nonce', _nonce)
      //n.copy(_nonce)
      n = Buffer.from(_nonce)
      console.log('n', n)
      sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        cipher, message, adata || null, null, _nonce, _secret)
      //return { _nonce, cipher }
    })
  })

  return { nonce, cipher }
}

/**
 * Decrypt symmetric cipher text given a nonce, secret, and optional auth data
 * @example
 * const message = mosodium.aead.dec(nonce, cipher, secret)
 *
 * @param {Buffer} nonce - sometimes called initialization vector (iv)
 * @param {Buffer} cipher - the cipher text
 * @param {SecBuf} secret - symmetric secret key
 * @param {Buffer} adata - optional additional authenticated data
 * @return {Buffer} - message
 */
exports.dec = async function aeadDec (nonce, cipher, secret, adata) {
  if (!(nonce instanceof SecBuf)) {
    throw new Error('nonce must be a SecBuf')
  }
  if (!(cipher instanceof Buffer)) {
    throw new Error('cipher must be a Buffer')
  }
  if (!(secret instanceof SecBuf)) {
    throw new Error('secret must be a SecBuf')
  }
  if (adata && !(adata instanceof Buffer)) {
    throw new Error('if you supply adata, it must be a Buffer')
  }

  const message = Buffer.alloc(cipher.byteLength - ABYTES)

  await secret.readable(async (_secret) => {
    await nonce.readable((_nonce) => {
      sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        message, null, cipher, adata || null, _nonce, _secret)
    })
  })

  return message
}
