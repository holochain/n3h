const sodium = require('sodium-native')
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

exports.SALT_BYTES = sodium.crypto_pwhash_SALTBYTES

function _fixOpts (opts) {
  opts || (opts = {})
  opts.opslimit || (opts.opslimit = OPSLIMIT_SENSITIVE)
  opts.memlimit || (opts.memlimit = MEMLIMIT_SENSITIVE)
  opts.algorithm || (opts.algorithm = ALG_ARGON2ID13)
  return opts
}

async function asyncPwHash (rawOut, rawPw, rawSalt, opts) {
  return new Promise((resolve, reject) => {
    try {
      sodium.crypto_pwhash_async(
        rawOut, rawPw, rawSalt,
        opts.opslimit, opts.memlimit, opts.algorithm,
        err => {
          try {
            if (err) return reject(err)
            resolve()
          } catch (e) {
            reject(e)
          }
        })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * Calculate a password hash
 * @param {SecBuf} output - output of the hashed password
 * @param {SecBuf} password - the password to hash
 * @param {SecBuf} [salt] - predefined salt (random if not included)
 * @param {object} opts
 * @param {number} opts.opslimit - operation scaling for hashing algorithm
 * @param {number} opts.memlimit - memory scaling for hashing algorithm
 * @param {number} opts.algorithm - which hashing algorithm
 */
exports.pwhash = async function pwhash (output, password, salt, opts) {
  const [ sbOutput, sbPass, sbSalt ] = await Promise.all([
    SecBuf.ref(output),
    SecBuf.ref(password),
    SecBuf.ref(salt)
  ])

  opts = _fixOpts(opts)

  // if (!salt) {
  //   await sbSalt.randomize()
  // }

  await sbSalt.readable(async _salt => {
    await sbPass.readable(async _password => {
      await sbOutput.writable(async _output => {
        await asyncPwHash(_output, _password, _salt, opts)
      })
    })
  })
}
