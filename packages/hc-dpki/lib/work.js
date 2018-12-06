const mosodium = require('@holochain/mosodium')

const DEF_WORK_TARGET = Buffer.from('000000000000000000000000000000000000000000000000000000000000b400', 'hex')

/**
 * verify that a given nonce is below our WORK_TARGET threshold
 * @param {object} opt
 * @param {Buffer} opt.key
 * @param {SecBuf} opt.nonce
 * @param {Buffer} [opt.workTarget]
 */
exports.verify = async function workVerify (opt) {
  opt.workTarget || (opt.workTarget = DEF_WORK_TARGET)

  const res = await mosodium.pwhash.hash(opt.nonce, {
    salt: opt.key,
    opslimit: mosodium.pwhash.OPSLIMIT_INTERACTIVE,
    memlimit: mosodium.pwhash.MEMLIMIT_MODERATE
  })

  let out = false
  res.hash.readable(h => {
    h = mosodium.hash.sha256(h)
    out = mosodium.util.compare(h, opt.workTarget) < 0
  })

  return out
}

/**
 * search for a nonce that satisfies our WORK_TARGET threshold
 * @param {object} opt
 * @param {Buffer} opt.key
 * @param {function} [opt.progress]
 * @param {string} [opt.startNonce]
 * @param {Buffer} [opt.workTarget]
 */
exports.search = async function workSearch (opt) {
  if (typeof opt.progress !== 'function') {
    opt.progress = () => {}
  }

  let nonce
  if (typeof opt.startNonce === 'string') {
    nonce = mosodium.SecBuf.from(Buffer.from(opt.startNonce, 'hex'))
  } else {
    nonce = new mosodium.SecBuf(32)
    nonce.randomize()
  }

  let opCount = 0
  for (;;) {
    const done = await exports.verify({
      key: opt.key,
      nonce,
      workTarget: opt.workTarget
    })
    if (done) {
      let out
      nonce.readable(n => {
        out = n.toString('hex')
      })
      return out
    }

    nonce.writable(n => mosodium.util.increment(n))
    opCount += 1

    opt.progress(opCount)
  }
}
