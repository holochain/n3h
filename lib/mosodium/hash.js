const sodium = require('sodium-native')
const { SecBuf } = require('./secbuf')

const SHA256_BYTES = exports.SHA256_BYTES = sodium.crypto_hash_sha256_BYTES
const SHA512_BYTES = exports.SHA512_BYTES = sodium.crypto_hash_sha512_BYTES

/**
 * Compute the sha256 hash of input buffer
 * @param {Buffer} input - the data to hash
 * @param {Buffer} output - the hashed data
 */
exports.sha256 = async function sha256 (input, output) {
  input = await SecBuf.ref(input)
  output = await SecBuf.ref(output)
  if (output.size() !== SHA256_BYTES) {
    throw new Error('output buffer bad size: ' + output.size() + ', expected: ' + SHA256_BYTES)
  }
  await output.writable(async w => {
    await input.readable(async r => {
      sodium.crypto_hash_sha256(w, r)
    })
  })
}

/**
 * Compute the sha512 hash of input buffer
 * @param {Buffer} input - the data to hash
 * @param {Buffer} output - the hashed data
 */
exports.sha512 = async function sha512 (input, output) {
  input = await SecBuf.ref(input)
  output = await SecBuf.ref(output)
  if (output.size() !== SHA512_BYTES) {
    throw new Error('output buffer bad size: ' + output.size() + ', expected: ' + SHA512_BYTES)
  }
  await output.writable(async w => {
    await input.readable(async r => {
      sodium.crypto_hash_sha512(w, r)
    })
  })
}
