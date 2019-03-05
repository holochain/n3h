const sodium = require('sodium-native')

const random = require('./random')
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
exports.enc = function aeadEnc (message, secret, adata) {
  if (!(message instanceof Buffer)) {
    throw new Error('message must be a Buffer')
  }
  if (!(secret instanceof SecBuf)) {
    throw new Error('secret must be a SecBuf')
  }
  if (adata && !(adata instanceof Buffer)) {
    throw new Error('if you supply adata, it must be a Buffer')
  }

  const nonce = random.bytes(NONCEBYTES)

  const cipher = Buffer.alloc(message.byteLength + ABYTES)

  secret.readable((_secret) => {
    sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      cipher, message, adata || null, null, nonce, _secret)
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
exports.dec = function aeadDec (nonce, cipher, secret, adata) {
  if (!(nonce instanceof Buffer)) {
    throw new Error('nonce must be a Buffer')
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

  secret.readable((_secret) => {
    sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      message, null, cipher, adata || null, nonce, _secret)
  })

  return message
}
