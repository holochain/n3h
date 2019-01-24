const msgpack = require('msgpack-lite')

exports.locHashes = (map) => {
  const blist = []
  for (let [l, h] of map) {
    blist.push(Buffer.from([l]))
    blist.push(Buffer.from(h, 'base64'))
  }
  return msgpack.encode(['locHashes', Buffer.concat(blist)]).toString('base64')
}

exports.parse = (b) => {
  const raw = msgpack.decode(Buffer.from(b, 'base64'))
  switch (raw[0]) {
    case 'locHashes':
      const out = new Map()
      for (let i = 0; i < raw[1].byteLength; i += 33) {
        out.set(
          raw[1].readUInt8(i).toString(),
          raw[1].slice(i + 1, i + 33).toString('base64')
        )
      }
      return {
        type: 'locHashes',
        map: out
      }
    default:
      throw new Error('unexpected gossip header: ' + raw[0])
  }
}
