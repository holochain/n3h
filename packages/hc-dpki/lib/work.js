const mosodium = require('mosodium')

const WORK_TARGET = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 180, 0])

/**
 * verify that a given nonce is below our WORK_TARGET threshold
 */
exports.verify = async function workVerify (key, nonce) {
  const res = await mosodium.pwhash.hash(nonce, {
    salt: key,
    opslimit: mosodium.pwhash.OPSLIMIT_INTERACTIVE,
    memlimit: mosodium.pwhash.MEMLIMIT_MODERATE
  })

  let out = false
  res.hash.readable(h => {
    h = mosodium.hash.sha256(h)
    out = mosodium.util.compare(h, WORK_TARGET) < 0
  })

  return out
}

/**
 * search for a nonce that satisfies our WORK_TARGET threshold
 */
exports.search = async function workSearch (key, progress, startNonce) {
  if (typeof progress !== 'function') {
    progress = () => {}
  }

  let nonce
  if (typeof startNonce === 'string') {
    nonce = mosodium.SecBuf.from(Buffer.from(startNonce, 'hex'))
  } else {
    nonce = new mosodium.SecBuf(32)
    nonce.randomize()
  }

  let opCount = 0
  for (;;) {
    const done = await exports.verify(key, nonce)
    if (done) {
      let out
      nonce.readable(n => {
        out = n.toString('hex')
      })
      return out
    }

    nonce.writable(n => mosodium.util.increment(n))
    opCount += 1

    progress(opCount)
  }
}
