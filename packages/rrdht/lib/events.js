const EVT_MAGIC = '$rrdht$event$'

/**
 */
exports.isEvent = function isEvent (evt) {
  return typeof evt === 'object' && evt[EVT_MAGIC] && Object.isFrozen(evt)
}

/**
 */
const createEvent = exports.createEvent = function createEvent (type, params) {
  params = JSON.parse(JSON.stringify(params))
  const out = Object.create(null)
  Object.defineProperty(out, 'type', {
    value: type,
    enumerable: true
  })
  Object.defineProperty(out, EVT_MAGIC, {
    value: true
  })
  for (let k in params) {
    if (k === 'type' || k === EVT_MAGIC) {
      throw new Error('bad event parameter')
    }
    Object.defineProperty(out, k, {
      value: params[k],
      enumerable: true
    })
  }
  Object.freeze(out)
  return out
}

function assertString (v) {
  if (typeof v !== 'string') {
    throw new Error('param must be a string')
  }
}

function assertStringArray (v) {
  if (Array.isArray(v)) {
    for (let i of v) {
      if (typeof i !== 'string') {
        break
      }
    }
    return
  }
  throw new Error('param must be a string array')
}

function assertObject (v) {
  if (v && typeof v === 'object') {
    return
  }
  throw new Error('param must be an object')
}

const types = exports.types = {
  GOSSIP_TO: 'gossipTo',
  UNRELIABLE_GOSSIP_BROADCAST: 'unreliableGossipBroadcast',
  PEER_HOLD_REQUEST: 'peerHoldRequest',
  DATA_HOLD_REQUEST: 'dataHoldRequest',
  DATA_FETCH: 'dataFetch',
  DATA_PRUNE: 'dataPrune'
}

/**
 * Instructs implementors to send this binary gossip bundle
 * to the specified peer Id in a reliable manner.
 */
exports.gossipTo = function gossipTo (peer, bundle) {
  assertString(peer)
  assertString(bundle)
  return createEvent(types.GOSSIP_TO, { peer, bundle })
}

/**
 * Instructs implementors to send this binary gossip bundle
 * to as many peers listed in peerList as possible.
 * It is okay if not all peers on the list receive the message.
 */
exports.unreliableGossipBroadcast = function unreliableGossipBroadcast (peerList, bundle) {
  assertStringArray(peerList)
  assertString(bundle)
  return createEvent(types.UNRELIABLE_GOSSIP_BROADCAST, { peerList, bundle })
}

/**
 * Tell implementors that gossip is requesting we hold a peer discovery
 * data item. Note that this dht tracker has not actually marked this item
 * for holding until the implementors pass back in a peerHoldRequest ACTION.
 */
exports.peerHoldRequest = function peerHoldRequest (peerHash, peerNonce, peerInfo) {
  assertString(peerHash)
  assertString(peerNonce)
  assertObject(peerInfo)
  return createEvent(types.PEER_HOLD_REQUEST, { peerHash, peerNonce, peerInfo })
}

/**
 * Tell implementors that gossip is requesting we hold a
 * data item. Note that this dht tracker has not actually marked this item
 * for holding until the implementors pass back in a dataHoldRequest ACTION.
 */
exports.dataHoldRequest = function dataHoldRequest (dataHash, data) {
  assertString(dataHash)
  assertString(data)
  return createEvent(types.DATA_HOLD_REQUEST, { dataHash, data })
}

/**
 * This dht tracker requires access to the data associated with a data hash.
 * This event should cause implementors to respond with a dataFetchResponse
 * action.
 */
exports.dataFetch = function dataFetch (dataHash, msgId) {
  assertString(dataHash)
  return createEvent(types.DATA_FETCH, { dataHash, msgId })
}

/**
 * Tell our implementors that we are no longer tracking this data
 * locally. Implementors should purge this hash from storage,
 * but that can, of course, choose not to.
 */
exports.dataPrune = function dataPrune (dataHash) {
  assertString(dataHash)
  return createEvent(types.DATA_PRUNE, { dataHash })
}
