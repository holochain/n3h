const mosodium = require('mosodium')
const msgpack = require('msgpack-lite')

/**
 * using base64url encoding (https://tools.ietf.org/html/rfc4648#section-5)
 */
function encodeId (signPub, encPub) {
  const hash = mosodium.hash.sha256(Buffer.concat([signPub, encPub]))

  let c = hash.readInt16LE(0)
  for (let i = 2; i < 32; i += 2) {
    c = c ^ hash.readInt16LE(i)
  }

  const checksum = Buffer.alloc(2)
  checksum.writeInt16LE(c, 0)

  return Buffer.concat([signPub, encPub, checksum]).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
}

exports.encodeId = encodeId

/**
 * using base64url encoding (https://tools.ietf.org/html/rfc4648#section-5)
 */
function decodeId (id) {
  const tmp = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  return {
    signPub: tmp.slice(0, 32),
    encPub: tmp.slice(32, 64)
  }
}

exports.decodeId = decodeId

/**
 */
function verify (signature, data, signerId) {
  const { signPub } = decodeId(signerId)
  return mosodium.sign.verify(signature, data, signPub)
}

exports.verify = verify

exports.pwhashOpslimit = mosodium.pwhash.OPSLIMIT_SENSITIVE
exports.pwhashMemlimit = mosodium.pwhash.MEMLIMIT_SENSITIVE

/**
 */
async function pwHash (pass, salt) {
  const opt = {
    opslimit: exports.pwhashOpslimit,
    memlimit: exports.pwhashMemlimit,
    algorithm: mosodium.pwhash.ALG_ARGON3ID13
  }

  if (salt) {
    opt.salt = salt
  }

  return mosodium.pwhash.hash(pass, opt)
}

exports.pwHash = pwHash

/**
 */
async function pwEnc (data, passphrase) {
  const { salt, hash: secret } = await pwHash(passphrase)
  const { nonce, cipher } = mosodium.aead.enc(data, secret)
  return msgpack.encode({
    salt,
    nonce,
    cipher
  })
}

exports.pwEnc = pwEnc

/**
 */
async function pwDec (data, passphrase) {
  data = msgpack.decode(data)
  const { hash: secret } = await pwHash(passphrase, data.salt)
  return mosodium.aead.dec(data.nonce, data.cipher, secret)
}

exports.pwDec = pwDec
