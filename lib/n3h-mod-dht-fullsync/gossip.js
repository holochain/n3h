const msgpack = require('msgpack-lite')

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
 * Encode a (loc -> hash) into a gossip buffer
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
 * Decode a gossip buffer into a (loc -> hash)
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
 * Encode a [peerId] into a gossip buffer
 */
function encodePeerAddressList (bufferList, list) {
  bufferList.push(list.map(e => e))
}

/**
 * Decode gossip buffer into [peerId]
 */
function decodePeerAddressList (bufferList) {
  return bufferList.shift().map(e => e)
}

/**
 * Encode a (peerId -> Ts) into a gossip buffer
 */
function encodePeerAddressToTsMap (bufferList, map) {
  const keylist = []
  const tslist = []
  for (let [p, ts] of iterMap(map)) {
    keylist.push(p)
    tslist.push(ts)
  }
  bufferList.push(keylist)
  bufferList.push(tslist)
}

/**
 * Decode a gossip buffer into a (peerId -> Ts)
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
      keylist[i],
      tslist[i]
    )
  }

  return map
}

/**
 * Encode a (peerId -> peerInfo) into a gossip buffer
 */
function encodePeerMap (bufferList, map) {
  const keylist = []
  const datalist = []
  for (let [p, d] of iterMap(map)) {
    keylist.push(p)
    datalist.push(Buffer.from(d))
  }
  bufferList.push(keylist)
  bufferList.push(datalist)
}

/**
 * Decode a gossip buffer into a (peerId -> peerInfo)
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
      keylist[i],
      datalist[i].toString()
    )
  }
  return map
}

/**
 * Encode a (dataAddress -> dataBlob) into a gossip buffer
 */
function encodeDataMap (bufferList, map) {
  const keylist = []
  const datalist = []
  for (let [a, d] of iterMap(map)) {
    keylist.push(Buffer.from(a, 'utf8'))
    datalist.push(Buffer.from(d, 'base64'))
  }
  bufferList.push(keylist)
  bufferList.push(datalist)
}

/**
 * Decode a gossip buffer into a (dataAddress -> dataBlob)
 */
function decodeDataMap (bufferList) {
  const keylist = bufferList.shift()
  const datalist = bufferList.shift()
  if (keylist.length !== datalist.length) {
    throw new Error('bad array lens')
  }
  const map = new Map()
  for (let i = 0; i < keylist.length; ++i) {
    map.set(
      keylist[i].toString('utf8'),
      datalist[i].toString('base64')
    )
  }
  return map
}

/**
 * Encode a [dataAddress] into a gossip buffer
 */
function encodeDataAddressList (bufferList, list) {
  bufferList.push(list.map(e => Buffer.from(e, 'utf8')))
}

/**
 * Decode a gossip buffer into a [dataAddress]
 */
function decodeDataAddressList (bufferList) {
  return bufferList.shift().map(e => e.toString('utf8'))
}

/**
 * Encode a (dataAddress -> [contentHash]) into a gossip buffer
 */
function encodeDataAddressToHashListMap (bufferList, map) {
  const keylist = []
  const hashlistlist = []
  for (let [a, hl] of iterMap(map)) {
    keylist.push(Buffer.from(a, 'utf8'))
    hashlistlist.push(hl.map(e => Buffer.from(e, 'base64')))
  }
  bufferList.push(keylist)
  bufferList.push(hashlistlist)
}

/**
 * Decode a gossip buffer into a (dataAddress -> [contentHash])
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
      keylist[i].toString('utf8'),
      hashlistlist[i].map(e => e.toString('base64'))
    )
  }

  return map
}

/**
 * Encode a [loc] into a gossip buffer
 */
function encodeLocList (bufferList, locList) {
  const llist = []
  for (let loc of locList) {
    llist.push(parseInt(loc, 10))
  }
  bufferList.push(Buffer.from(llist))
}

/**
 * Decode a gossip buffer into a [loc]
 */
function decodeLocList (bufferList) {
  const buffer = bufferList.shift()
  const out = []
  for (let i = 0; i < buffer.byteLength; ++i) {
    out.push(buffer.readUInt8(i).toString())
  }
  return out
}

// -- exports -- //

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
  encodeDataMap(blist, dataMap)

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
      out.dataMap = decodeDataMap(blist)
      return out
    default:
      throw new Error('unexpected gossip header: ' + type)
  }
}
