const sodium = require('sodium-native')
const { SecBuf } = require('./secbuf')

/**
 * Output `count` random bytes
 * @example
 * const bytes = mosodium.random.bytes(32)
 *
 * @param {number} count - number of random bytes to output
 * @return {Buffer}
 */
exports.randomBuffer = async function randomBuffer (buf) {
  buf = await SecBuf.ref(buf)
  await buf.writable(async w => {
    sodium.randombytes_buf(w)
  })
}
