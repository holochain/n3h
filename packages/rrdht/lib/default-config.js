const mosodium = require('@holochain/mosodium')
const { PersistCacheMem } = require('./persist-cache-mem')

// -- configuration parameters -- //

/**
 * set this if you would like to change the default agent location work target
 */
exports.agentLocWorkTarget = Buffer.from('000000000000000000000000000000000000000000000000000000000000b400', 'hex')

/**
 * The class to use for persistence (if you use the default
 * persistCacheGet and persistCacheSet methods)
 */
exports.PersistCache = PersistCacheMem

// -- debug configuration parameters -- //

/**
 * set this if you always want the nonce to start at a certain point
 * (mostly used for unit testing)
 */
exports.debugAgentLocSearchStartNonce = null

// -- configuration functions -- //

/**
 * hash function powered by sha256
 * @param {object} config - reference to config object
 * @param {Buffer} buf - the buffer to hash
 */
exports.hashFn = async function hashFn (config, buf) {
  assertBuffer(buf)
  return mosodium.hash.sha256(buf)
}

/**
 * derive a data location from a data hash
 * @param {object} config - reference to config object
 * @param {Buffer} hash - the hash to convert to a location
 */
exports.dataLocFn = async function dataLocFn (config, hash) {
  assertBuffer(hash, 32)
  return bufCompress(hash)
}

/**
 * get an agent location hash from an agent hash and a nonce
 * @param {object} config - reference to config object
 * @param {Buffer} hash - the agent hash (sha256 of a binary agentId)
 * @param {Buffer} nonce - the calculated nonce to apply
 */
exports.agentLocHashFn = async function agentLocHashFn (config, hash, nonce) {
  assertBuffer(hash, 32)
  assertBuffer(nonce, 32)

  nonce = mosodium.SecBuf.from(nonce)

  const res = await mosodium.pwhash.hash(nonce, {
    salt: hash,
    opslimit: mosodium.pwhash.OPSLIMIT_INTERACTIVE,
    memlimit: mosodium.pwhash.MEMLIMIT_MODERATE
  })

  let locHash
  res.hash.readable(h => {
    locHash = mosodium.hash.sha256(h)
  })

  return locHash
}

/**
 * derive an agent location from an agent hash (sha256 of a binary agentId)
 * @param {object} config - reference to config object
 * @param {Buffer} hash - the agent hash (sha256 of a binary agentId)
 * @param {Buffer} nonce - the calculated nonce to apply
 */
exports.agentLocFn = async function agentLocFn (config, hash, nonce) {
  assertBuffer(hash, 32)
  assertBuffer(nonce, 32)
  const locHash = await config.agentLocHashFn(config, hash, nonce)
  await config.agentLocVerifyFn(config, locHash)
  return bufCompress(hash)
}

/**
 * @param {object} config - reference to config object
 */
exports.agentLocVerifyFn = async function agentLocVerifyFn (config, locHash) {
  if (mosodium.util.compare(locHash, config.agentLocWorkTarget) < 0) {
    return
  }

  throw new Error('invalid location nonce; bad work verification')
}

/**
 * @param {object} config - reference to config object
 */
exports.agentLocSearchFn = async function agentLocSearchFn (config, hash) {
  let nonce
  if (config.debugAgentLocSearchStartNonce) {
    nonce = mosodium.SecBuf.from(config.debugAgentLocSearchStartNonce)
  } else {
    nonce = new mosodium.SecBuf(32)
    nonce.randomize()
  }

  for (;;) {
    try {
      let rawNonce
      nonce.readable(n => {
        rawNonce = Buffer.from(n)
      })
      await config.agentLocVerifyFn(
        config, await config.agentLocHashFn(
          config, hash, rawNonce))
      break
    } catch (e) { /* pass */ }

    nonce.writable(n => mosodium.util.increment(n))
  }

  let out
  nonce.readable(n => {
    out = Buffer.from(n)
  })

  return out
}

/**
 */
exports.persistCacheGet = async function persistCacheGet (config, ns, key) {
  const cache = await getPersistCacheSingleton(config)

  return cache.get(ns, key)
}

/**
 */
exports.persistCacheSet = async function persistCacheSet (config, ns, key, data) {
  const cache = await getPersistCacheSingleton(config)

  return cache.set(ns, key, data)
}

// -- helper functions -- //

let persistCacheSingleton = null

/**
 * helper get the persistCache singleton
 */
async function getPersistCacheSingleton (config) {
  if (!persistCacheSingleton) {
    persistCacheSingleton = await new config.PersistCache()
  }
  return persistCacheSingleton
}

/**
 * helper checks if a buffer is the correct length
 */
function assertBuffer (b, l) {
  if (!(b instanceof Buffer)) {
    throw new Error(typeof b + ' required to be a Buffer')
  }
  if (l && b.byteLength !== l) {
    throw new Error('Buffer.byteLength was ' + b.byteLength + ' but ' + l + ' was required')
  }
}

/**
 * helper compresses a buffer into 4 bytes using xor
 */
function bufCompress (b) {
  let tmp = b.readInt32LE(0)
  for (let i = 4; i < b.byteLength; i += 4) {
    tmp = tmp ^ b.readInt32LE(i)
  }
  const out = Buffer.alloc(4)
  out.writeInt32LE(tmp, 0)
  return out
}
