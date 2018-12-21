const mosodium = require('@holochain/mosodium')
const { PersistCacheMem } = require('./persist-cache-mem')
const { SKArrayStoreMem } = require('./skarray-store-mem')

// -- configuration parameters -- //

/**
 * set this if you would like to change the default agent location work target
 * the from(..., 'hex').toString('base64') is just to make editing easier
 */
exports.agentLocWorkTarget = Buffer.from('000000000000000000000000000000000000000000000000000000000000b400', 'hex').toString('base64')

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
 * @param {string} buf - the base64 buffer to hash
 * @param {string} - the base64 encoded sha256 hash of buf
 */
exports.hashFn = async function hashFn (config, buf) {
  buf = assertBuffer(buf)
  return mosodium.hash.sha256(buf).toString('base64')
}

/**
 * derive a data location from a data hash
 * @param {object} config - reference to config object
 * @param {string} hash - the base64 hash to convert to a location
 * @return {string} the base64 encoded 4 byte location
 */
exports.dataLocFn = async function dataLocFn (config, hash) {
  hash = assertBuffer(hash, 32)
  return bufCompress(hash).toString('base64')
}

/**
 * get an agent location hash from an agent hash and a nonce
 * @param {object} config - reference to config object
 * @param {string} hash - the agent hash (sha256 of a binary agentId)
 * @param {string} nonce - the calculated nonce to apply
 * @param {string} - the base64 encoded full 32 byte location hash
 */
exports.agentLocHashFn = async function agentLocHashFn (config, hash, nonce) {
  hash = assertBuffer(hash, 32)
  nonce = assertBuffer(nonce, 32)

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

  return locHash.toString('base64')
}

/**
 * derive an agent location from an agent hash (sha256 of a binary agentId)
 * @param {object} config - reference to config object
 * @param {string} hash - the agent hash (sha256 of a binary agentId)
 * @param {string} nonce - the calculated nonce to apply
 * @return {string} the base64 encoded 4 byte location
 */
exports.agentLocFn = async function agentLocFn (config, hash, nonce) {
  const rawHash = assertBuffer(hash, 32)
  const locHash = await config.agentLocHashFn(hash, nonce)
  await config.agentLocVerifyFn(locHash)
  return bufCompress(rawHash).toString('base64')
}

/**
 * @param {object} config - reference to config object
 * @param {string} locHash - the hash to verify against work target
 */
exports.agentLocVerifyFn = async function agentLocVerifyFn (config, locHash) {
  locHash = assertBuffer(locHash, 32)
  const workTgt = assertBuffer(config.agentLocWorkTarget, 32)

  if (mosodium.util.compare(locHash, workTgt) < 0) {
    return
  }

  throw new Error('invalid location nonce; bad work verification')
}

/**
 * @param {object} config - reference to config object
 * @param {string} hash - the hash to find a nonce for that satisfies work tgt
 * @return {string} - the nonce discovered
 */
exports.agentLocSearchFn = async function agentLocSearchFn (config, hash) {
  hash = assertBuffer(hash, 32)

  let nonce
  if (config.debugAgentLocSearchStartNonce) {
    const startNonce = assertBuffer(config.debugAgentLocSearchStartNonce, 32)
    nonce = mosodium.SecBuf.from(startNonce)
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
        await config.agentLocHashFn(
          hash.toString('base64'), rawNonce.toString('base64')))
      break
    } catch (e) { /* pass */ }

    nonce.writable(n => mosodium.util.increment(n))
  }

  let out
  nonce.readable(n => {
    out = Buffer.from(n)
  })

  return out.toString('base64')
}

/**
 * get an sk-array-store for a particular namespace
 * note this may be called multiple times, and should return an instance
 * with access to the same data every time.
 */
exports.getSKArrayStore = async function getSKArrayStore (config, ns) {
  if (!config.runtimeState._skArrayStores) {
    config.runtimeState._skArrayStores = {}
  }
  const ref = config.runtimeState._skArrayStores
  if (!(ns in ref)) {
    ref[ns] = await new SKArrayStoreMem()
  }
  return ref[ns]
}

/**
 * get a persist cache instance that conforms to the persist cache api
 * note this may be called multiple times, and should return an instance
 * with access to the same data every time.
 */
exports.getPersistCache = async function getPersistCache (config) {
  if (!config.runtimeState._persistCache) {
    config.runtimeState._persistCache = await new PersistCacheMem()
  }
  return config.runtimeState._persistCache
}

const PROXY_FIX = [
  'then',
  'Symbol(util.inspect.custom)',
  'inspect',
  'Symbol(Symbol.iterator)',
  'Symbol(Symbol.toStringTag)'
]

/**
 */
exports.persistCacheProxy = async function persistCacheProxy (config, ns) {
  if (!config.runtimeState._persistCacheProxyCache) {
    config.runtimeState._persistCacheProxyCache = {}
  }
  if (!(ns in config.runtimeState._persistCacheProxyCache)) {
    const inst = await config.getPersistCache()
    config.runtimeState._persistCacheProxyCache[ns] = new Proxy(Object.create(null), {
      get: (_, prop) => {
        // it's hard to return a proxy from an async function in nodejs...
        if (PROXY_FIX.indexOf(prop.toString()) > -1) {
          return
        }
        const out = () => {
          return inst.get(ns, prop)
        }
        out.has = val => {
          return inst.has(ns, prop)
        }
        out.set = val => {
          return inst.set(ns, prop, val)
        }
        out.remove = () => {
          return inst.remove(ns, prop)
        }
        return out
      },
      set: () => {
        throw new Error('use `await config.prop()` to get, `await config.prop.set(val)` to set, `await config.prop.remove()` to remove')
      }
    })
  }
  return config.runtimeState._persistCacheProxyCache[ns]
}

// -- config object builder -- //

const CONFIG_MAGIC = '$rrdht$config$'
const CLASS_CONFIG = ['PersistCache']

/**
 */
exports.isConfigObject = function isConfigObject (o) {
  return typeof o === 'object' && o[CONFIG_MAGIC] === true && Object.isFrozen(o)
}

/**
 */
exports.generateConfigBuilder = function generateConfigBuilder () {
  const config = {}

  const builder = {}

  const attachOne = (k, v) => {
    if (typeof v === 'function' && CLASS_CONFIG.indexOf(k) < 0) {
      config[k] = (...args) => v(config, ...args)
    } else {
      config[k] = v
    }
  }

  builder.attach = (o) => {
    for (let k in o) {
      if (k in config) {
        throw new Error('"' + k + '" already registered in config object')
      }
      const v = o[k]
      attachOne(k, v)
    }
    return builder
  }

  builder.preInvoke = async (fn) => {
    await fn(config)
  }

  builder.finalize = async (fn) => {
    for (let key in exports) {
      if (key !== 'generateConfigBuilder' && key !== 'isConfigObject' && !(key in config)) {
        attachOne(key, exports[key])
      }
    }

    Object.defineProperty(config, CONFIG_MAGIC, {
      value: true
    })

    const runtimeState = {}
    attachOne('runtimeState', runtimeState)
    attachOne('_', runtimeState)

    attachOne('$', await config.persistCacheProxy('$'))

    if (typeof fn === 'function') {
      await fn(config)
    }

    Object.freeze(config)

    builder.attach = builder.preInvoke = builder.finalize = () => {
      throw new Error('finalize already invoked, builder functions invalid')
    }

    return config
  }

  return builder
}

// -- helper functions -- //

/**
 * helper checks if a buffer is the correct length
 */
function assertBuffer (b, l) {
  if (typeof b !== 'string') {
    throw new Error(typeof b + ' required to be a base64 binary string')
  }
  b = Buffer.from(b, 'base64')
  if (l && b.byteLength !== l) {
    throw new Error('Buffer.byteLength was ' + b.byteLength + ' but ' + l + ' was required')
  }
  return b
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
