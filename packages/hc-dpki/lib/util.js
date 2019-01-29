const mosodium = require('@holochain/mosodium')
const msgpack = require('msgpack-lite')
const { Encoder, Decoder } = require('@holochain/n-bch-rs')

const rsEncoder = new Encoder(6)
const rsDecoder = new Decoder(6)

/**
 * using base64url encoding (https://tools.ietf.org/html/rfc4648#section-5)
 * Generate an identity string with a pair of public keys
 * @param {Buffer} signPub - singing public key
 * @param {Buffer} encPub - encryption public key
 * @return {string} - the base64url encoded identity (with parity bytes)
 */
function encodeId (signPub, encPub) {
  const res = Buffer.concat([
    Buffer.from([0x86, 0x46]),
    rsEncoder.encode(Buffer.concat([signPub, encPub]))
  ])
  return res.toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
}

exports.encodeId = encodeId

/**
 * using base64url encoding (https://tools.ietf.org/html/rfc4648#section-5)
 * break an identity string up into a pair of public keys
 * @param {string} id - the base64url encoded identity string
 * @return {object} - { signPub: Buffer, encPub: Buffer }
 */
function decodeId (id) {
  let tmp = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

  if (tmp[0] === 0x86 && tmp[1] === 0x46) {
    tmp = tmp.slice(2)
  }

  if (tmp.byteLength !== 70) {
    throw new Error('invalid agent id')
  }

  if (rsDecoder.is_corrupted(tmp)) {
    tmp = rsDecoder.correct(tmp)
  }

  return {
    signPub: tmp.slice(0, 32),
    encPub: tmp.slice(32, 64)
  }
}

exports.decodeId = decodeId

/**
 * verify a signature given the original data, and the signer's identity string
 * @param {Buffer} signature - the binary signature
 * @param {Buffer} data - the binary data to verify
 * @param {string} signerId - the signer's public identity string
 */
function verify (signature, data, signerId) {
  const { signPub } = decodeId(signerId)
  return mosodium.sign.verify(signature, data, signPub)
}

exports.verify = verify

// allow overrides for unit-testing purposes
exports.pwhashOpslimit = mosodium.pwhash.OPSLIMIT_SENSITIVE
exports.pwhashMemlimit = mosodium.pwhash.MEMLIMIT_SENSITIVE

/**
 * simplify the api for generating a password hash with our set parameters
 * @param {SecBuf} pass - the password buffer to hash
 * @param {Buffer} [salt] - if specified, hash with this salt (otherwise random)
 * @return {object} - { salt: Buffer, hash: SecBuf }
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
 * Helper for encrypting a buffer with a pwhash-ed passphrase
 * @param {Buffer} data
 * @param {string} passphrase
 * @return {Buffer} - the encrypted data
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
 * Helper for decrypting a buffer with a pwhash-ed passphrase
 * @param {Buffer} data
 * @param {string} passphrase
 * @return {Buffer} - the decrypted data
 */
async function pwDec (data, passphrase) {
  data = msgpack.decode(data)
  const { hash: secret } = await pwHash(passphrase, data.salt)
  return mosodium.aead.dec(data.nonce, data.cipher, secret)
}

exports.pwDec = pwDec
