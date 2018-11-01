const sodium = require('sodium-native')
const { SecBuf } = require('./secbuf')

const CONTEXTBYTES = sodium.crypto_kdf_CONTEXTBYTES

/**
 * Derive a subkey from a parent key
 * @example
 * const subkey = mosodium.kdf.derive(1, Buffer.from('eightchr'), pk)
 *
 * @param {number} index - subkey index
 * @param {Buffer} context - eight bytes context
 * @param {SecBuf} parent - the parent key to derive from
 * @return {SecBuf}
 */
exports.derive = function kdfDerive (index, context, parent) {
  if (typeof index !== 'number' || parseInt(index) !== index) {
    throw new Error('index must be an integer')
  }
  if (!(context instanceof Buffer) || context.byteLength !== CONTEXTBYTES) {
    throw new Error('context must be a Buffer of length ' + CONTEXTBYTES)
  }
  if (!(parent instanceof SecBuf)) {
    throw new Error('parent must be a SecBuf')
  }
  const out = new SecBuf(32)
  out.writable(_out => {
    parent.readable(_parent => {
      sodium.crypto_kdf_derive_from_key(_out, index, context, _parent)
    })
  })

  return out
}
