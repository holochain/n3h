const { AsyncClass } = require('@holochain/n3h-common')
const { Encoding } = require('@holochain/hcid-js')
const mosodium = require('@holochain/mosodium')
const util = require('./util')

const hcs0 = new Encoding('hcs0')
const hck0 = new Encoding('hck0')

// allow overrides for unit-testing purposes
exports.pwhashOpslimit = mosodium.pwhash.OPSLIMIT_SENSITIVE
exports.pwhashMemlimit = mosodium.pwhash.MEMLIMIT_SENSITIVE

// secbuf pita, just hack it for now
async function pubPwHash (pass, salt) {
  if (pass instanceof mosodium.SecBuf) {
    pass.readable(r => {
      pass = Buffer.from(r)
    })
  }

  if (salt instanceof mosodium.SecBuf) {
    salt.readable(r => {
      salt = Buffer.from(r)
    })
  }

  const opt = {
    opslimit: exports.pwhashOpslimit,
    memlimit: exports.pwhashMemlimit,
    algorithm: mosodium.pwhash.ALG_ARGON3ID13,
    salt
  }

  let res = (await mosodium.pwhash.hash(mosodium.SecBuf.from(pass), opt)).hash
  res.readable(r => {
    res = Buffer.from(r)
  })
  return res
}

const DEF_WORK_TARGET = Buffer.from('000000000000000000000000000000000000000000000000000000000000b400', 'hex')
const EZ_WORK_TARGET = Buffer.from('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 'hex')

/**
 */
class WorkId extends AsyncClass {
  /**
   */
  async init (id) {
    await super.init()
    this._id = id
    this._idBuf = hcs0.decode(id)
    this._workHash = await this._calcWorkHash()
  }

  /**
   */
  isValid (tgt) {
    tgt || (tgt = EZ_WORK_TARGET)
    return mosodium.util.compare(this._workHash, tgt) < 0
  }

  // -- private -- //

  /**
   */
  async _calcWorkHash () {
    const workStep1 = mosodium.kdf.derive(
      1,
      Buffer.from(KDF_CONTEXT['work'], 'utf8'),
      mosodium.SecBuf.from(Buffer.concat([
        this._idBuf,
        Buffer.from(WORK_DERIVE[0], 'base64')
      ])),
      mosodium.SecBuf.LOCK_NONE
    )

    const workStep2 = await pubPwHash(
      workStep1, Buffer.from(WORK_DERIVE[1], 'base64')
    )

    const workStep3 = mosodium.hash.sha512(Buffer.concat([
      workStep2, Buffer.from(WORK_DERIVE[2], 'base64')
    ]))

    const workStep4 = mosodium.hash.sha256(
      Buffer.concat([
        workStep3,
        Buffer.from(WORK_DERIVE[3], 'base64')
      ])
    )

    return workStep4
  }
}

/**
 */
class Seed extends AsyncClass {
  static async fromRaw (secbuf) {
    return new Seed(secbuf)
  }

  static async fromRandom () {
    let seed = new mosodium.SecBuf(32)
    seed.randomize()
    return new Seed(seed)
  }

  async init (seed) {
    await super.init()

    if (!(seed instanceof mosodium.SecBuf)) {
      throw new Error('seed must be a SecBuf')
    }

    this._seed = seed
  }

  async deriveNonce (nonce) {
    const nseed = new mosodium.SecBuf(64)
    nseed.writable(w => {
      this._seed.readable(r => {
        r.copy(w)
      })
      nonce.copy(w, 32)
    })
    return new Seed(mosodium.SecBuf.from(mosodium.hash.sha256(nseed)))
  }

  async deriveKdf (context, index) {
    if (!(context in KDF_CONTEXT)) {
      throw new Error('context must be one of ' + JSON.stringify(Object.keys(KDF_CONTEXT)))
    }
    context = Buffer.from(KDF_CONTEXT[context], 'utf8')
    if (!(context instanceof Buffer) || context.byteLength !== 8) {
      throw new Error('context must be an 8 byte buffer')
    }
    if (typeof index !== 'number') {
      throw new Error('index must be a number')
    }
    return new Seed(mosodium.kdf.derive(
      index, Buffer.from(context), this._seed, this._seed.lockLevel()))
  }

  async derivePass (pass) {
    if (!(pass instanceof mosodium.SecBuf)) {
      throw new Error('pass must be a SecBuf')
    }
    return new Seed(mosodium.SecBuf.from(await pubPwHash(pass, this._seed)))
  }

  async toSign () {
    const pair = mosodium.sign.seedKeypair(this._seed, this._seed.lockLevel())

    const id = hcs0.encode(pair.publicKey)

    const workId = await new WorkId(id)

    return {
      id,
      priv: pair.secretKey,
      workId
    }
  }

  async toKey () {
    const pair = mosodium.kx.seedKeypair(this._seed, this._seed.lockLevel())
    return {
      id: hck0.encode(pair.publicKey),
      priv: pair.secretKey
    }
  }
}

const KDF_CONTEXT = Seed.prototype.KDF_CONTEXT = {
  revoke: 'HCREVOKE',
  device: 'HCDEVICE',
  authorize: 'HCAUTHRZ',
  application: 'HCAPPLIC',
  work: 'HCWORKDR'
}

const WORK_DERIVE = Seed.prototype.WORK_DERIVE = [
  'pn5Z7WPP7TqKTeD7/zGkUdoHd6mwYq+MPKROYKfjXjI=',
  'o/t93Ezy5qTjzspGM2rErHtmCpHkNFRoTtiXilTk19A=',
  'fxhLaDAJ64Iq/UY1HZucKFjNPo9EMjOtiAAfjtZLObI=',
  'tHgL0WgGEmNoEv114toOyhgRk6zNzL6YhFSY/x+DtBA='
]

async function test () {
  const root = await Seed.fromRandom()
  const rev = await root.deriveKdf('revoke', 1)

  const dev = await root.deriveKdf('device', 42)
  const devPin = await dev.derivePass(mosodium.SecBuf.from(
    Buffer.from('837638')))

  const auth = await devPin.deriveKdf('authorize', 1)
  const app = await devPin.deriveKdf('application', 31)

  const appN = await app.deriveNonce(mosodium.random.bytes(32))

  const revSig = await rev.toSign()
  const authSig = await auth.toSign()
  const appSig = await appN.toSign()
  const appKey = await appN.toKey()

  console.log({
    revoke: revSig.id,
    authorize: authSig.id,
    application: [appSig.id, appSig.workId.isValid(), appKey.id]
  })
}

test().then(() => {}, err => {
  console.error(err)
  process.exit(1)
})
