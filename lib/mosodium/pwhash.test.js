const expect = require('chai').expect
const sodium = require('./index')
const { SecBuf } = require('./secbuf')

describe('pwhash Suite', () => {
  before(() => {
    sodium.SecBuf.setLockLevel(sodium.SecBuf.LOCK_NONE)
  })

  it('should throw if bad pw', async () => {
    try {
      await sodium.pwhash.hash()
    } catch (e) {
      // yay exception
      return
    }
    throw new Error('expected exception, but got success')
  })

  it('should generate consistantly', async () => {
    const password = new sodium.SecBuf(2)

    const pw1 = await sodium.pwhash.hash(password, {
      opslimit: sodium.pwhash.OPSLIMIT_INTERACTIVE,
      memlimit: sodium.pwhash.MEMLIMIT_INTERACTIVE
    })

    const pw2 = await sodium.pwhash.hash(password, {
      opslimit: sodium.pwhash.OPSLIMIT_INTERACTIVE,
      memlimit: sodium.pwhash.MEMLIMIT_INTERACTIVE,
      salt: pw1.salt
    })

    pw1.hash.readable((_pw1) => {
      pw2.hash.readable((_pw2) => {
        expect(_pw1.toString('base64')).equals(_pw2.toString('base64'))
      })
    })

    pw2.hash.free()
    pw1.hash.free()
    password.free()
  })

  it('should generate consistantly with secbuf as input', async () => {
    const password = new sodium.SecBuf(2)

    const pw1 = await sodium.pwhash.hash(password, {
      opslimit: sodium.pwhash.OPSLIMIT_INTERACTIVE, 
      memlimit: sodium.pwhash.MEMLIMIT_INTERACTIVE
    })

    sodium.SecBuf.setLockLevel(sodium.SecBuf.LOCK_MEM)
    let hash = new SecBuf(32)

    const pw2 = await sodium.pwhash.hash(password, {
      opslimit: sodium.pwhash.OPSLIMIT_INTERACTIVE,
      memlimit: sodium.pwhash.MEMLIMIT_INTERACTIVE, salt: pw1.salt
    }, hash)

    pw1.hash.readable((_pw1) => {
      hash.readable((_hash) => {
        expect(_pw1.toString('base64')).equals(_hash.toString('base64'))
      })
    })

    hash.free()
    pw2.hash.free()
    pw1.hash.free()
    password.free()
  })
})
