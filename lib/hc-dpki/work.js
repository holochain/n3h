const mosodium = require('../mosodium')

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

  let secret = await mosodium.SecBuf.secure(32)
  await mosodium.pwhash.pwhash(secret, opt.nonce, opt.key, {
    opslimit: mosodium.pwhash.OPSLIMIT_INTERACTIVE,
    memlimit: mosodium.pwhash.MEMLIMIT_MODERATE
  })

  const sbTarget = await mosodium.SecBuf.ref(opt.workTarget)
  let out = false
  await secret.readable(async h => {
    const hh = await mosodium.SecBuf.insecure(mosodium.hash.SHA256_BYTES)
    await mosodium.hash.sha256(h, hh)
    await hh.readable(async _hh => {
      out = await sbTarget.compare(_hh)
      out = out > 0
    })
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
    nonce = await mosodium.SecBuf.ref(Buffer.from(opt.startNonce, 'hex'))
  } else {
    nonce = await mosodium.SecBuf.secure(32)
    await nonce.randomize()
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

    await nonce.increment()
    opCount += 1

    opt.progress(opCount)
  }
}
