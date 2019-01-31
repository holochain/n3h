const bs58 = require('bs58')

/**
 */
exports.decode = mh => {
  return bs58.decode(mh).slice(2).toString('base64')
}

/**
 */
exports.encode = h => {
  return bs58.encode(Buffer.concat([
    Buffer.from([0x12, 0x20]),
    Buffer.from(h, 'base64')
  ]))
}
