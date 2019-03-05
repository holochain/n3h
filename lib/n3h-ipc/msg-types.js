/*!
 * n3h IPC constants and message descriptions
 */

const msgpack = require('msgpack-lite')

/// ipc server magic identifier
exports.SRV_ID = Buffer.from([0x24, 0x24, 0x24, 0x24])

/**
 */
exports.encode = function encode (name, data) {
  switch (name) {
    case 'json':
      data = Buffer.from(JSON.stringify(data, null, 2), 'utf8')
      break
    case 'namedBinary':
    case 'ping':
    case 'pong':
      data = msgpack.encode(data)
      break
    default:
      throw new Error('unexpected n3h-ipc msg type: "' + name + '"')
  }
  return {
    name: Buffer.from(name, 'utf8'),
    data
  }
}

/**
 */
exports.decode = function decode (name, data) {
  name = name.toString('utf8')
  switch (name) {
    case 'json':
      return {
        name,
        data: JSON.parse(data.toString('utf8'))
      }
    case 'namedBinary':
    case 'ping':
    case 'pong':
      return {
        name,
        data: msgpack.decode(data)
      }
    default:
      throw new Error('unexpected n3h-ipc msg type: "' + name + '"')
  }
}
