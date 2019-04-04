const sodium = require('sodium-native')
const { SecBuf } = require('./secbuf')

const SEED_BYTES = exports.SEED_BYTES = sodium.crypto_sign_SEEDBYTES
const PUBLICKEY_BYTES = exports.PUBLICKEY_BYTES = sodium.crypto_sign_PUBLICKEYBYTES
const SECRETKEY_BYTES = exports.SECRETKEY_BYTES = sodium.crypto_sign_SECRETKEYBYTES
const SIG_BYTES = exports.SIG_BYTES = sodium.crypto_sign_BYTES

/**
 * Generate a signing keypair from a seed buffer
 * @example
 * const { publicKey, secretKey } = mosodium.sign.seedKeypair(seed)
 *
 * @param {SecBuf} seed - the seed to derive a keypair from
 * @retun {object} - { publicKey, privateKey }
 */
exports.signSeedKeypair = async function signSeedKeypair (publicKey, secretKey, seed) {
  const [ sbPubKey, sbSecKey, sbSeed ] = await Promise.all([
    SecBuf.ref(publicKey),
    SecBuf.ref(secretKey),
    SecBuf.ref(seed)
  ])

  if (sbSeed.size() !== SEED_BYTES) {
    throw new Error('bad seed size')
  }
  if (sbPubKey.size() !== PUBLICKEY_BYTES) {
    throw new Error('bad publicKey size')
  }
  if (sbSecKey.size() !== SECRETKEY_BYTES) {
    throw new Error('bad secretKey size')
  }

  await sbSeed.readable(async _seed => {
    await sbPubKey.writable(async _publicKey => {
      await sbSecKey.writable(async _secretKey => {
        sodium.crypto_sign_seed_keypair(_publicKey, _secretKey, _seed)
      })
    })
  })
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
exports.signSign = async function signSign (signature, message, secretKey) {
  const [ sbMsg, sbSecKey, sbSig ] = await Promise.all([
    SecBuf.ref(message),
    SecBuf.ref(secretKey),
    SecBuf.ref(signature)
  ])

  if (sbSecKey.size() !== SECRETKEY_BYTES) {
    throw new Error('bad secretKey size: ' + sbSecKey.size() + ', expected: ' + SECRETKEY_BYTES)
  }
  if (sbSig.size() !== SIG_BYTES) {
    throw new Error('bad signature size')
  }

  await sbSig.writable(async _signature => {
    await sbMsg.readable(async _message => {
      await sbSecKey.readable(async _secretKey => {
        sodium.crypto_sign_detached(_signature, _message, _secretKey)
      })
    })
  })
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
exports.signVerify = async function signVerify (signature, message, publicKey) {
  const [ sbSig, sbMsg, sbPubKey ] = await Promise.all([
    SecBuf.ref(signature),
    SecBuf.ref(message),
    SecBuf.ref(publicKey)
  ])

  let out = false
  await sbSig.readable(async _signature => {
    await sbMsg.readable(async _message => {
      await sbPubKey.readable(async _publicKey => {
        out = sodium.crypto_sign_verify_detached(
          _signature, _message, _publicKey)
      })
    })
  })

  return out
}
