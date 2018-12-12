const mosodium = require('mosodium')

function assertBuffer (b, l) {
  if (!(b instanceof Buffer)) {
    throw new Error(typeof b + ' required to be a Buffer')
  }
  if (l && b.byteLength !== l) {
    throw new Error('Buffer.byteLength was ' + b.byteLength + ' but ' + l + ' was required')
  }
}

function bufCompress (b) {
  let tmp = locHash.readInt32LE(0);
  for (let i = 4; i < locHash.length; i += 4) {
    tmp = tmp ^ locHash.readInt32LE(i)
  }
  const out = Buffer.alloc(4)
  out.writeInt32LE(tmp, 0)
  return out
}

/**
 */
exports.hashFn = async function hashFn (config, buf) {
  assertBuffer(buf)
  return mosodium.hash.sha256(buf)
}

/**
 */
exports.dataLocFn = async function dataLocFn (config, hash) {
  assertBuffer(hash, 32)
  return bufCompress(hash)
}

/**
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
 */
exports.agentLocFn = async function agentLocFn (config, hash, nonce) {
  assertBuffer(hash, 32)
  assertBuffer(nonce, 32)
  const locHash = config.agentLocHashFn(config, hash, nonce)
  await config.agentLocVerifyFn(config, locHash)
  return bufCompress(locHash)
}

/**
 */
exports.agentLocWorkTarget = Buffer.from('000000000000000000000000000000000000000000000000000000000000b400', 'hex')

/**
 */
exports.agentLocVerifyFn = async function agentLocVerifyFn (config, locHash) {
  if (mosodium.util.compare(locHash, config.agentLocWorkTarget) < 0) {
    return
  }

  throw new Error('invalid location nonce; bad work verification')
}

/**
 */
exports.debugAgentLocSearchStartNonce = null

/**
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
      nonce.readable(n => {
        await config.agentLocVerifyFn(
          config, config.agentLocHashFn(
            config, hash, n))
      })
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
