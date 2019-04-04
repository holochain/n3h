const sodium = require('sodium-native')
const { SecBuf } = require('./secbuf')

const CONTEXT_BYTES = exports.CONTEXT_BYTES = sodium.crypto_kdf_CONTEXTBYTES

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
exports.kdfDerive = async function kdfDerive (output, index, context, parent) {
  const [ sbOut, sbCtx, sbParent ] = await Promise.all([
    SecBuf.ref(output),
    SecBuf.ref(context),
    SecBuf.ref(parent)
  ])

  if (typeof index !== 'number' || parseInt(index) !== index) {
    throw new Error('index must be an integer')
  }

  if (sbCtx.size() !== CONTEXT_BYTES) {
    throw new Error('context must be a Buffer of length ' + CONTEXT_BYTES)
  }

  await sbOut.writable(async _out => {
    await sbParent.readable(async _parent => {
      await sbCtx.readable(async _ctx => {
        sodium.crypto_kdf_derive_from_key(_out, index, _ctx, _parent)
      })
    })
  })
}
