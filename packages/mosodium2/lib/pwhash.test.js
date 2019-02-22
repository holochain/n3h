const expect = require('chai').expect
const mosodium = require('./index')

describe('pwhash Suite', () => {
  it('should throw if bad pw', async () => {
    try {
      await mosodium.pwhash.pwhash()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should generate consistantly', async () => {
    const [
      pw,
      salt,
      output
    ] = await Promise.all([
      mosodium.SecBuf.ref(Buffer.from('test')),
      mosodium.SecBuf.ref(Buffer.from('drUpmsHbWiQWMJqcp64PeW5KuFBY20flF1cBsmJudo8=')),
      mosodium.SecBuf.insecure(32)
    ])

    await mosodium.pwhash.pwhash(output, pw, salt, {
      opslimit: mosodium.pwhash.OPSLIMIT_INTERACTIVE,
      memlimit: mosodium.pwhash.MEMLIMIT_INTERACTIVE
    })

    let res = null
    output.readable(r => { res = r.toString('base64') })

    expect(res).equals('0QGRu1EICy5v/Y4WrLM+YixF8bi7rNDYJVxF4UD93IQ=')

    await Promise.all([
      pw.destroy(),
      salt.destroy(),
      output.destroy()
    ])
  })
})
