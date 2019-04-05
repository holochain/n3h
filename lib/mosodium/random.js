const sodium = require('sodium-native')
const { SecBuf } = require('./secbuf')

/**
 * Randomize a Buffer
 * @param {Buffer} buf - buffer to randomize
 */
exports.randomBuffer = async function randomBuffer (buf) {
  buf = await SecBuf.ref(buf)
  await buf.writable(async w => {
    sodium.randombytes_buf(w)
  })
}
