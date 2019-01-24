const msgpack = require('msgpack-lite')
const { encodeId, decodeId } = require('@holochain/hc-dpki')

/**
 */
function iterMap (m) {
  if (m instanceof Map) {
    return m.entries()
  } else {
    return Object.entries(m)
  }
}

/**
 */
function encodeLocToHashMap (bufferList, map) {
  const mlist = []
  for (let [l, h] of iterMap(map)) {
    mlist.push(Buffer.from([parseInt(l, 10)]))
    mlist.push(Buffer.from(h, 'base64'))
  }
  bufferList.push(Buffer.concat(mlist))
}

/**
 */
function decodeLocToHashMap (bufferList) {
  const buffer = bufferList.shift()
  const out = new Map()
  for (let i = 0; i < buffer.byteLength; i += 33) {
    out.set(
      buffer.readUInt8(i).toString(),
      buffer.slice(i + 1, i + 33).toString('base64')
    )
  }
  return out
}

/**
 */
function encodePeerAddress (peerAddress) {
  const { signPub, encPub } = decodeId(peerAddress)
  return Buffer.concat([ signPub, encPub ])
}

/**
 */
function decodePeerAddress (buffer) {
  return encodeId(buffer.slice(0, 32), buffer.slice(32, 64))
}

/**
 */
function encodePeerAddressList (bufferList, list) {
  bufferList.push(list.map(e => encodePeerAddress(e)))
}

/**
 */
function decodePeerAddressList (bufferList) {
  return bufferList.shift().map(e => decodePeerAddress(e))
}

/**
 */
function encodePeerAddressToTsMap (bufferList, map) {
  const keylist = []
  const tslist = []
  for (let [p, ts] of iterMap(map)) {
    keylist.push(encodePeerAddress(p))
    tslist.push(ts)
  }
  bufferList.push(keylist)
  bufferList.push(tslist)
}

/**
 */
function decodePeerAddressToTsMap (bufferList) {
  const keylist = bufferList.shift()
  const tslist = bufferList.shift()

  if (keylist.length !== tslist.length) {
    throw new Error('bad array lens')
  }

  const map = new Map()
  for (let i = 0; i < keylist.length; ++i) {
    map.set(
      decodePeerAddress(keylist[i]),
      tslist[i]
    )
  }

  return map
}

/**
 */
function encodePeerMap (bufferList, map) {
  const keylist = []
  const datalist = []
  for (let [p, d] of iterMap(map)) {
    keylist.push(encodePeerAddress(p))
    datalist.push(Buffer.from(d))
  }
  bufferList.push(keylist)
  bufferList.push(datalist)
}

/**
 */
function decodePeerMap (bufferList) {
  const keylist = bufferList.shift()
  const datalist = bufferList.shift()

  if (keylist.length !== datalist.length) {
    throw new Error('bad array lens')
  }

  const map = new Map()
  for (let i = 0; i < keylist.length; ++i) {
    map.set(
      decodePeerAddress(keylist[i]),
      datalist[i].toString()
    )
  }

  return map
}

/**
 */
function encodeDataAddressList (bufferList, list) {
  bufferList.push(list.map(e => Buffer.from(e, 'base64')))
}

/**
 */
function decodeDataAddressList (bufferList) {
  return bufferList.shift().map(e => e.toString('base64'))
}

/**
 */
function encodeDataAddressToHashListMap (bufferList, map) {
  const keylist = []
  const hashlistlist = []
  for (let [a, hl] of iterMap(map)) {
    keylist.push(Buffer.from(a, 'base64'))
    hashlistlist.push(hl.map(e => Buffer.from(e, 'base64')))
  }
  bufferList.push(keylist)
  bufferList.push(hashlistlist)
}

/**
 */
function decodeDataAddressToHashListMap (bufferList) {
  const keylist = bufferList.shift()
  const hashlistlist = bufferList.shift()

  if (keylist.length !== hashlistlist.length) {
    throw new Error('bad array lens')
  }

  const map = new Map()
  for (let i = 0; i < keylist.length; ++i) {
    map.set(
      keylist[i].toString('base64'),
      hashlistlist[i].map(e => e.toString('base64'))
    )
  }

  return map
}

/**
 */
function encodeLocList (bufferList, locList) {
  const llist = []
  for (let loc of locList) {
    llist.push(parseInt(loc, 10))
  }
  bufferList.push(Buffer.from(llist))
}

/**
 */
function decodeLocList (bufferList) {
  const buffer = bufferList.shift()
  const out = []
  for (let i = 0; i < buffer.byteLength; ++i) {
    out.push(buffer.readUInt8(i).toString())
  }
  return out
}

/**
 *
 */
exports.locHashes = (msgId, map) => {
  const blist = ['locHashes', msgId]
  encodeLocToHashMap(blist, map)
  return msgpack.encode(blist).toString('base64')
}

/**
 */
exports.hashDiff = (
  msgId, peerAddressToTsMap, dataAddressToHashListMap, requestLocList
) => {
  const blist = ['hashDiff', msgId]

  encodePeerAddressToTsMap(blist, peerAddressToTsMap)
  encodeDataAddressToHashListMap(blist, dataAddressToHashListMap)
  encodeLocList(blist, requestLocList)

  return msgpack.encode(blist).toString('base64')
}

/**
 */
exports.hashDiffResp = (
  msgId, peerAddressToTsMap, dataAddressToHashListMap
) => {
  const blist = ['hashDiffResp', msgId]

  encodePeerAddressToTsMap(blist, peerAddressToTsMap)
  encodeDataAddressToHashListMap(blist, dataAddressToHashListMap)

  return msgpack.encode(blist).toString('base64')
}

/**
 */
exports.fetchAddressList = (msgId, peerAddressList, dataAddressList) => {
  const blist = ['fetchAddressList', msgId]

  encodePeerAddressList(blist, peerAddressList)
  encodeDataAddressList(blist, dataAddressList)

  return msgpack.encode(blist).toString('base64')
}

/**
 */
exports.fetchAddressListResp = (msgId, peerMap, dataMap) => {
  const blist = ['fetchAddressListResp', msgId]

  encodePeerMap(blist, peerMap)

  return msgpack.encode(blist).toString('base64')
}

/**
 */
exports.parse = (b) => {
  const blist = msgpack.decode(Buffer.from(b, 'base64'))
  const type = blist.shift()
  const msgId = blist.shift()
  const out = { type, msgId }
  switch (type) {
    case 'locHashes':
      out.map = decodeLocToHashMap(blist)
      return out
    case 'hashDiff':
      out.peerAddressToTsMap = decodePeerAddressToTsMap(blist)
      out.dataAddressToHashListMap = decodeDataAddressToHashListMap(blist)
      out.requestLocList = decodeLocList(blist)
      return out
    case 'hashDiffResp':
      out.peerAddressToTsMap = decodePeerAddressToTsMap(blist)
      out.dataAddressToHashListMap = decodeDataAddressToHashListMap(blist)
      return out
    case 'fetchAddressList':
      out.peerAddressList = decodePeerAddressList(blist)
      out.dataAddressList = decodeDataAddressList(blist)
      return out
    case 'fetchAddressListResp':
      out.peerMap = decodePeerMap(blist)
      return out
    default:
      throw new Error('unexpected gossip header: ' + type)
  }
}
