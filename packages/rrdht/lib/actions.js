// const range = require('./range')

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

const RE_RADII = /^[a-f0-9]{24}$/
function assertRadii (v) {
  if (!RE_RADII.test(v)) {
    throw new Error('param must be 24 hex characters (12 bytes)')
  }
}

/*
function assertRange (v) {
  try {
    const vv = range.rValidate(v)
    if (v !== vv) {
      throw new Error()
    }
  } catch (e) {
    throw new Error('param must be a valid range')
  }
}
*/

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
exports.peerHoldRequest = function peerHoldRequest (opt) {
  assertObject(opt)
  assertString(opt.peerHash)
  assertString(opt.peerNonce)
  assertRadii(opt.radii)
  return {
    action: 'peerHoldRequest',
    params: {
      peerHash: opt.peerHash,
      peerNonce: opt.peerNonce,
      radii: opt.radii
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
 * We recieved a dataFetch event... If we have that data,
 * publish this dataFetchResponse action.
 */
exports.dataFetchResponse = function dataFetchResponse (msgId, data) {
  assertString(msgId)
  assertString(data)
  return {
    action: 'dataFetchResponse',
    params: {
      msgId,
      data
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
      dataHash,
      data
    }
  }
}
