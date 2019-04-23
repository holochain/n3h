const sodium = require('sodium-native')

const { SecBuf } = require('./secbuf')

exports.NONCE_BYTES =
  sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
const A_BYTES = exports.A_BYTES =
  sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES
exports.KEY_BYTES =
  sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES

/**
 * Generate symmetric cipher text given a message, secret, and optional auth data
 * @example
 * const nonce = await mosodium.random.randomBytes(mosodium.aead.NONCE_BYTES)
 * const cipher = mosodium.aead.enc(nonce, Buffer.from('hello'), secret, null)
 *
 * @param {Buffer|SecBuf} nonce - initialization vector
 * @param {Buffer|SecBuf} message - data to encrypt
 * @param {Buffer|SecBuf} secret - symmetric secret key
 * @param {Buffer|SecBuf} [adata] - optional additional authenticated data
 * @return {Buffer} - cipher
 */
exports.aeadEnc = async function aeadEnc (nonce, message, secret, adata) {
  const [
    sbNonce, sbMessage, sbSecret
  ] = await Promise.all([
    SecBuf.ref(nonce),
    SecBuf.ref(message),
    SecBuf.ref(secret)
  ])

  let sbAData = null
  if (adata) {
    sbAData = await SecBuf.ref(adata)
  }

  const cipher = Buffer.alloc(sbMessage.size() + A_BYTES)

  await SecBuf.unlockMulti([
    [sbNonce, 'readable'],
    [sbMessage, 'readable'],
    [sbSecret, 'readable']
  ], async (nonce, message, secret) => {
    if (sbAData) {
      await sbAData.readable(async adata => {
        sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
          cipher, message, adata, null, nonce, secret)
      })
    } else {
      sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        cipher, message, null, null, nonce, secret)
    }
  })

  return cipher
}

/**
 * Decrypt symmetric cipher text given a nonce, secret, and optional auth data
 * @example
 * const message = await mosodium.SecBuf.insecure(
 *   cipher.byteLength - mosodium.aead.A_BYTES)
 * await mosodium.aead.dec(message, nonce, cipher, secret, null)
 *
 * @param {Buffer|SecBuf} message - output buffer
 * @param {Buffer|SecBuf} nonce - sometimes called initialization vector (iv)
 * @param {Buffer|SecBuf} cipher - the cipher text
 * @param {Buffer|SecBuf} secret - symmetric secret key
 * @param {Buffer|SecBuf} [adata] - optional additional authenticated data
 */
exports.aeadDec = async function aeadDec (message, nonce, cipher, secret, adata) {
  const [
    sbMessage, sbNonce, sbCipher, sbSecret
  ] = await Promise.all([
    SecBuf.ref(message),
    SecBuf.ref(nonce),
    SecBuf.ref(cipher),
    SecBuf.ref(secret)
  ])

  let sbAData = null
  if (adata) {
    sbAData = await SecBuf.ref(adata)
  }

  await SecBuf.unlockMulti([
    [sbMessage, 'writable'],
    [sbNonce, 'readable'],
    [sbCipher, 'readable'],
    [sbSecret, 'readable']
  ], async (message, nonce, cipher, secret) => {
    if (sbAData) {
      await sbAData.readable(async adata => {
        sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
          message, null, cipher, adata, nonce, secret)
      })
    } else {
      sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        message, null, cipher, null, nonce, secret)
    }
  })
}
