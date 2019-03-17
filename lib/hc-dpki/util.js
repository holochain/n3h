const mosodium = require('../mosodium')
const msgpack = require('msgpack-lite')
const { Encoding } = require('@holochain/hcid-js')

const signCodec = new Encoding('hcs0')
const encCodec = new Encoding('hck0')

/**
 * Generate an identity string with a public signing key
 * @param {UInt8Array} signPub - Public signing key
 * @return {string} - the base32 encoded identity (with parity bytes)
 */
function encodeSign (signPub) {
  return signCodec.encode(signPub)
}

/**
 * Generate an identity string with a public encrypting key
 * @param {UInt8Array} signPub - Public encrypting key
 * @return {string} - the base32 encoded identity (with parity bytes)
 */
function encodeEnc (encPub) {
  return encCodec.encode(encPub)
}

exports.encodeSign = encodeSign
exports.encodeEnc = encodeEnc

/**
 * Convert an identity string into a public signing key
 * @param {string} id - the base32 encoded identity string
 * @return {Buffer} - Buffer holding the public signing key
 */
function decodeSign (id) {
  return Buffer.from(signCodec.decode(id))
}

/**
 * Convert an identity string into a public encrypting key
 * @param {string} id - the base32 encoded identity string
 * @return {Buffer} - Buffer holding the public encrypting key
 */
function decodeEnc (id) {
  return Buffer.from(encCodec.decode(id))
}

exports.decodeSign = decodeSign
exports.decodeEnc = decodeEnc

/**
 * verify a signature given the original data, and the signer's identity string
 * @param {Buffer} signature - the binary signature
 * @param {Buffer} data - the binary data to verify
 * @param {string} signerId - the signer's public identity string
 */
function verify (signature, data, signerId) {
  const signPub = decodeSign(signerId)
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
