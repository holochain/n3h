const msgpack = require('msgpack-lite')
const { encodeId, decodeId } = require('@holochain/hc-dpki')

/**
 */
function peerAddressToBuffer (peerAddress) {
  const { signPub, encPub } = decodeId(peerAddress)
  return Buffer.concat([ signPub, encPub ])
}

/**
 */
function encodePeerAddress (buffer) {
  return encodeId(buffer.slice(0, 32), buffer.slice(32, 64))
}

/**
 */
exports.locHashes = (map) => {
  const blist = []
  for (let [l, h] of map) {
    blist.push(Buffer.from([parseInt(l, 10)]))
    blist.push(Buffer.from(h, 'base64'))
  }
  return msgpack.encode(['locHashes', Buffer.concat(blist)]).toString('base64')
}

/**
 */
exports.hashDiff = (peerAddressList, dataAddressList, requestLocs) => {
  let plist = []
  for (let p of peerAddressList) {
    plist.push(peerAddressToBuffer(p))
  }
  plist = Buffer.concat(plist)
  let dlist = []
  for (let d of dataAddressList) {
    dlist.push(Buffer.from(d, 'base64'))
  }
  dlist = Buffer.concat(dlist)
  let llist = []
  for (let loc of requestLocs) {
    llist.push(parseInt(loc, 10))
  }
  llist = Buffer.from(llist)
  return msgpack.encode(['hashDiff', plist, dlist, llist]).toString('base64')
}

/**
 */
exports.parse = (b) => {
  let out
  const raw = msgpack.decode(Buffer.from(b, 'base64'))
  switch (raw[0]) {
    case 'locHashes':
      out = new Map()
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
    case 'hashDiff':
      out = {
        type: 'hashDiff',
        peerAddressList: [],
        dataAddressList: [],
        requestLocs: []
      }
      for (let i = 0; i < raw[1].byteLength; i += 64) {
        out.peerAddressList.push(encodePeerAddress(raw[1].slice(i, i + 64)))
      }
      for (let i = 0; i < raw[2].byteLength; i += 32) {
        out.dataAddressList.push(raw[2].slice(i, i + 32).toString('base64'))
      }
      for (let i = 0; i < raw[3].byteLength; ++i) {
        out.requestLocs.push(raw[3].readUInt8(i).toString())
      }
      return out
    default:
      throw new Error('unexpected gossip header: ' + raw[0])
  }
}
