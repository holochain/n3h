const mosodium = require('../mosodium')
const msgpack = require('msgpack-lite')
// const { Encoder, Decoder } = require('@holochain/n-bch-rs')

const { Encoding } = require('@holochain/hcid-js')

const signCodec = new Encoding('hcs0')
const encCodec = new Encoding('hck0')
// const rsDecoder = new Decoder(6)

// /**
//  * using base64url encoding (https://tools.ietf.org/html/rfc4648#section-5)
//  * Generate an identity string with a pair of public keys
//  * @param {Buffer} signPub - singing public key
//  * @param {Buffer} encPub - encryption public key
//  * @return {string} - the base64url encoded identity (with parity bytes)
//  */

/**
 *
 * @param signPub - UInt8Array of bytes of signing public key
 * @returns {*}
 */
function encodeSign (signPub) {
  return signCodec.encode(signPub)
}

/**
 *
 * @param encPub - UInt8Array of bytes of signing public key
 * @returns {*}
 */
function encodeEnc (encPub) {
  return encCodec.encode(encPub)
}

exports.encodeSign = encodeSign
exports.encodeEnc = encodeEnc

// /**
//  * using base64url encoding (https://tools.ietf.org/html/rfc4648#section-5)
//  * break an identity string up into a pair of public keys
//  * @param {string} id - the base64url encoded identity string
//  * @return {object} - { signPub: Buffer, encPub: Buffer }
//  */

function decodeSign (id) {
  return signCodec.decode(id)
}
function decodeEnc (id) {
  return encCodec.decode(id)
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
  return mosodium.sign.verify(signature, data, Buffer.from(signPub))
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
