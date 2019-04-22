const sodium = require('sodium-native')

/**
 */
exports.randomBytes = async function randomBytes (size) {
  const buffer = Buffer.alloc(size)
  sodium.randombytes_buf(buffer)
  return buffer
}
