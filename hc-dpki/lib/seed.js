const { AsyncClass } = require('n3h-common')
const mosodium = require('mosodium')
const bip39 = require('bip39')

const { Keypair } = require('./keypair')
const util = require('./util')

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
  static async fromBundle (bundle, passphrase) {
    let Class = null
    switch (bundle.type) {
      case 'hcDeviceSeed':
        Class = DeviceSeed
        break
      case 'hcRootSeed':
        Class = RootSeed
        break
      default:
        throw new Error('unrecognized bundle type: "' + bundle.type + '"')
    }
    return new Class(mosodium.SecBuf.from(await util.pwDec(
      Buffer.from(bundle.data, 'base64'), passphrase)))
  }

  /**
   */
  async init (type, seed) {
    await super.init()

    if (typeof type !== 'string') {
      throw new Error('type must be specified for bundling')
    }
    this._type = type

    if (seed instanceof mosodium.SecBuf && seed.size() === 32) {
      this._seed = seed
    } else if (typeof seed === 'string' && seed.split(/\s/g).length === 24) {
      if (!bip39.validateMnemonic(seed)) {
        throw new Error('invalid mnemonic string')
      }
      this._seed = mosodium.SecBuf.from(
        Buffer.from(bip39.mnemonicToEntropy(seed), 'hex'))
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
  async getBundle (passphrase, hint) {
    if (typeof hint !== 'string') {
      throw new Error('hint must be a string')
    }

    this._seed.$makeReadable()
    const out = {
      type: this._type,
      hint,
      data: (await util.pwEnc(this._seed._, passphrase)).toString('base64')
    }
    this._seed.$restoreProtection()

    return out
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

exports.Seed = Seed

/**
 */
class DeviceSeed extends Seed {
  /**
   */
  async init (seed) {
    await super.init('hcDeviceSeed', seed)
  }

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
  async init (seed) {
    await super.init('hcRootSeed', seed)
  }

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
    const seed = await util.pwHash(pass, salt._)
    salt.$restoreProtection()

    return new DeviceSeed(seed.hash)
  }
}

exports.RootSeed = RootSeed
