function assertString (v) {
  if (typeof v !== 'string') {
    throw new Error('param must be a string')
  }
}

function assertObject (v) {
  if (v && typeof v === 'object') {
    return
  }
  throw new Error('param must be an object')
}

/**
 * We have received a gossip bundle from a remote node,
 * digest it, taking any needed actions
 */
exports.remoteGossipBundle = function remoteGossipBundle (bundle) {
  assertString(bundle)
  return {
    action: 'remoteGossipBundle',
    params: {
      bundle
    }
  }
}

/**
 * Implementors would like us to hold this peer info
 * We will decide if that makes sense or not, and take appropriate action
 */
exports.peerHoldRequest = function peerHoldRequest (peerHash, peerNonce, peerInfo) {
  assertString(peerHash)
  assertString(peerNonce)
  assertObject(peerInfo)
  return {
    action: 'peerHoldRequest',
    params: {
      peerHash,
      peerNonce,
      peerInfo
    }
  }
}

/**
 * Implementors would like us to hold this data
 * If we decide to keep this data, no events will be emitted
 * If we decide NOT to keep this data, a prune event will be emitted
 */
exports.dataHoldRequest = function dataHoldRequest (dataHash) {
  assertString(dataHash)
  return {
    action: 'dataHoldRequest',
    params: {
      dataHash
    }
  }
}

/**
 * Implementors would like this data publish appropriately on the network.
 * We will determine the appropriate neighborhood and broadcast.
 */
exports.dataPublish = function dataPublish (dataHash, data) {
  assertString(dataHash)
  assertString(data)
  return {
    action: 'dataPublish',
    params: {
      data
    }
  }
}
