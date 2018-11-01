const sodium = require('sodium-native')
const random = require('./random')
const { SecBuf } = require('./secbuf')

exports.OPSLIMIT_INTERACTIVE =
  sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE
exports.MEMLIMIT_INTERACTIVE =
  sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE
exports.OPSLIMIT_MODERATE =
  sodium.crypto_pwhash_OPSLIMIT_MODERATE
exports.MEMLIMIT_MODERATE =
  sodium.crypto_pwhash_MEMLIMIT_MODERATE
const OPSLIMIT_SENSITIVE = exports.OPSLIMIT_SENSITIVE =
  sodium.crypto_pwhash_OPSLIMIT_SENSITIVE
const MEMLIMIT_SENSITIVE = exports.MEMLIMIT_SENSITIVE =
  sodium.crypto_pwhash_MEMLIMIT_SENSITIVE

exports.ALG_ARGON2I13 =
  sodium.crypto_pwhash_ALG_ARGON2I13
const ALG_ARGON2ID13 = exports.ALG_ARGON2ID13 =
  sodium.crypto_pwhash_ALG_ARGON2ID13

const HASHBYTES = 32
const SALTBYTES = sodium.crypto_pwhash_SALTBYTES

function _fixOpts (opts) {
  opts || (opts = {})
  opts.opslimit || (opts.opslimit = OPSLIMIT_SENSITIVE)
  opts.memlimit || (opts.memlimit = MEMLIMIT_SENSITIVE)
  opts.algorithm || (opts.algorithm = ALG_ARGON2ID13)
  return opts
}

/**
 * Calculate a password hash
 * @example
 * const { salt, hash } = mosodium.pwhash.hash(passphrase)
 * @example
 * const { salt, hash } = mosodium.pwhash.hash(passphrase, {
 *   opslimit: mosodium.pwhash.OPSLIMIT_MODERATE,
 *   memlimit: mosodium.pwhash.MEMLIMIT_MODERATE,
 *   salt: mysalt
 * })
 * @param {SecBuf} password - the password to hash
 * @param {object} opts
 * @param {number} opts.opslimit - operation scaling for hashing algorithm
 * @param {number} opts.memlimit - memory scaling for hashing algorithm
 * @param {number} opts.algorithm - which hashing algorithm
 * @param {Buffer} [opts.salt] - predefined salt (random if not included)
 * @return {object} - { salt / the salt used /, hash / the hash generated / }
 */
exports.hash = function pwhash (password, opts) {
  if (!(password instanceof SecBuf)) {
    throw new Error('password must be a SecBuf')
  }
  opts = _fixOpts(opts)

  if (!opts.salt) {
    opts.salt = random.bytes(SALTBYTES)
  }

  const hash = new SecBuf(HASHBYTES)

  return new Promise((resolve, reject) => {
    const finalize = () => {
      password.$restoreProtection()
      hash.$restoreProtection()
    }
    try {
      password.$makeReadable()
      hash.$makeWritable()
      sodium.crypto_pwhash_async(
        hash._, password._, opts.salt,
        opts.opslimit, opts.memlimit, opts.algorithm,
        (err) => {
          try {
            finalize()
            if (err) return reject(err)
            resolve({
              salt: opts.salt,
              hash
            })
          } catch (e) {
            reject(e)
          }
        })
    } catch (e) {
      reject(e)
    }
  })
}
