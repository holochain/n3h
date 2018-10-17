const { AsyncClass } = require('n3h-common')
const mosodium = require('mosodium')
const bip39 = require('bip39')

const { Keypair } = require('./keypair')

exports.pwhashOpslimit = mosodium.pwhash.OPSLIMIT_SENSITIVE
exports.pwhashMemlimit = mosodium.pwhash.MEMLIMIT_SENSITIVE

/**
 */
class Seed extends AsyncClass {
  /**
   */
  static async newRandom () {
    const seed = new mosodium.SecBuf(32)
    seed.randomize()
    return new RootSeed(seed)
  }

  /**
   */
  async init (seed) {
    await super.init()

    if (seed instanceof mosodium.SecBuf && seed.size() === 32) {
      this._seed = seed
    } else if (typeof seed === 'string' && seed.split(/\s/g).length === 24) {
      if (!bip39.validateMnemonic(seed)) {
        throw new Error('invalid mnemonic string')
      }
      this._seed = new mosodium.SecBuf(32)
      const mnBuf = Buffer.from(bip39.mnemonicToEntropy(seed), 'hex')
      this._seed.writable(s => {
        mnBuf.copy(s)
        mnBuf.fill(0)
      })
    } else {
      throw new Error('`seed` must be a 32 byte mosodium.SecBuf or 24 word bip39 mnemonic string')
    }

    this.$pushDestructor(async () => {
      this._seed.free()
      this._seed = null
    })
  }

  /**
   */
  getMnemonic () {
    let out = null
    this._seed.readable(s => {
      out = bip39.entropyToMnemonic(s.toString('hex'))
    })
    return out
  }
}

/**
 */
class DeviceSeed extends Seed {
  /**
   */
  async getApplicationKeypair (index) {
    if (typeof index !== 'number' || parseInt(index, 10) !== index || index < 1) {
      throw new Error('invalid index')
    }

    const appSeed = mosodium.kdf.derive(
      index, Buffer.from('HCAPPLIC'), this._seed, this._seed.lockLevel())

    return Keypair.newFromSeed(appSeed)
  }
}

exports.DeviceSeed = DeviceSeed

/**
 */
class RootSeed extends Seed {
  /**
   */
  async getDeviceSeed (index, pin) {
    if (typeof index !== 'number' || parseInt(index, 10) !== index || index < 1) {
      throw new Error('invalid index')
    }

    pin = Buffer.from(pin, 'utf8')
    const pass = new mosodium.SecBuf(pin.byteLength)
    pass.writable(_pass => {
      pin.copy(_pass)
      pin.fill(0)
    })

    const salt = mosodium.kdf.derive(
      index, Buffer.from('HCDEVICE'), this._seed, this._seed.lockLevel())

    salt.$makeReadable()
    const seed = await mosodium.pwhash.hash(pass, {
      opslimit: exports.pwhashOpslimit,
      memlimit: exports.pwhashMemlimit,
      algorithm: mosodium.pwhash.ALG_ARGON2ID13,
      salt: salt._
    })
    salt.$restoreProtection()

    return new DeviceSeed(seed.hash)
  }
}

exports.RootSeed = RootSeed
