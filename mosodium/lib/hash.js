const sodium = require('sodium-native')

/**
 * XOR an arbitrary length buffer (byteLength must be a multiple of 4)
 * into an int32 sized javascript number
 * @example
 * const myInt = mosodium.hash.toInt(mosodium.hash.sha256(Buffer.from('hello')))
 *
 * @param {Buffer} input - the data to xor
 * @return {number}
 */
exports.toInt = function hashToInt (input) {
  if (!(input instanceof Buffer)) {
    throw new Error('input must be a Buffer')
  }
  if (parseInt(input.byteLength / 4) * 4 !== input.byteLength) {
    throw new Error('input buffer length must be divisible by 4')
  }
  let out = input.readInt32LE(0)
  for (let i = 4; i < input.byteLength; i += 4) {
    out = out ^ input.readInt32LE(i)
  }
  return out
}

/**
 * Compute the sha256 hash of input buffer
 * @example
 * const hash = mosodium.hash.sha256(Buffer.from('hello'))
 *
 * @param {Buffer} input - the data to hash
 * @return {Buffer}
 */
exports.sha256 = function hashSha256 (input) {
  if (!(input instanceof Buffer)) {
    throw new Error('input must be a Buffer')
  }
  const output = Buffer.alloc(sodium.crypto_hash_sha256_BYTES)
  sodium.crypto_hash_sha256(output, input)
  return output
}

/**
 * Compute the sha512 hash of input buffer
 * @example
 * const hash = mosodium.hash.sha512(Buffer.from('hello'))
 *
 * @param {Buffer} input - the data to hash
 * @return {Buffer}
 */
exports.sha512 = function hashSha512 (input) {
  if (!(input instanceof Buffer)) {
    throw new Error('input must be a Buffer')
  }
  const output = Buffer.alloc(sodium.crypto_hash_sha512_BYTES)
  sodium.crypto_hash_sha512(output, input)
  return output
}
