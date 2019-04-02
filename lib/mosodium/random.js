const sodium = require('sodium-native')

/**
 * Output `count` random bytes
 * @example
 * const bytes = mosodium.random.bytes(32)
 *
 * @param {number} count - number of random bytes to output
 * @return {Buffer}
 */
exports.bytes = function randomBytes (count) {
  const output = Buffer.alloc(count)
  sodium.randombytes_buf(output)
  return output
}
