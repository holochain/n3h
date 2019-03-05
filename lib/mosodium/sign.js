const sodium = require('sodium-native')
const { SecBuf } = require('./secbuf')

const PUBLICKEYBYTES = sodium.crypto_sign_PUBLICKEYBYTES
const SECRETKEYBYTES = sodium.crypto_sign_SECRETKEYBYTES
const SIGNBYTES = sodium.crypto_sign_BYTES

/**
 * Generate a signing keypair from a seed buffer
 * @example
 * const { publicKey, secretKey } = mosodium.sign.seedKeypair(seed)
 *
 * @param {SecBuf} seed - the seed to derive a keypair from
 * @retun {object} - { publicKey, privateKey }
 */
exports.seedKeypair = function signSeedKeypair (seed) {
  if (!(seed instanceof SecBuf)) {
    throw new Error('seed must be a SecBuf')
  }

  const publicKey = Buffer.alloc(PUBLICKEYBYTES)
  const secretKey = new SecBuf(SECRETKEYBYTES)

  seed.readable(_seed => {
    secretKey.writable(_secretKey => {
      sodium.crypto_sign_seed_keypair(publicKey, _secretKey, _seed)
    })
  })

  return {
    publicKey,
    secretKey
  }
}

/**
 * generate a signature
 * @example
 * const sig = mosodium.sign.sign(Buffer.from('hello'), secretKey)
 *
 * @param {Buffer} message - the message to sign
 * @param {SecBuf} secretKey - the secret key to sign with
 * @return {Buffer} signature data
 */
exports.sign = function signSign (message, secretKey) {
  if (!(message instanceof Buffer)) {
    throw new Error('message must be a Buffer')
  }
  if (!(secretKey instanceof SecBuf)) {
    throw new Error('secretKey must be a SecBuf')
  }

  const out = Buffer.alloc(SIGNBYTES)

  secretKey.readable(_secretKey => {
    sodium.crypto_sign_detached(out, message, _secretKey)
  })

  return out
}

/**
 * verify a signature given the message and a publicKey
 * @example
 * const isGood = mosodium.sign.verify(sig, Buffer.from('hello'), pubKey)
 *
 * @param {Buffer} signature
 * @param {Buffer} message
 * @param {Buffer} publicKey
 */
exports.verify = function signVerify (signature, message, publicKey) {
  if (!(signature instanceof Buffer)) {
    throw new Error('signature must be a Buffer')
  }
  if (!(message instanceof Buffer)) {
    throw new Error('message must be a Buffer')
  }
  if (!(publicKey instanceof Buffer)) {
    throw new Error('publicKey must be a Buffer')
  }

  return sodium.crypto_sign_verify_detached(signature, message, publicKey)
}
