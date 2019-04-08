const expect = require('chai').expect
const mosodium = require('./index')

describe('hash Suite', () => {
  it('should throw on bad sha256 input', async () => {
    try {
      await mosodium.hash.sha256('yo')
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should sha256', async () => {
    const out = await mosodium.SecBuf.insecure(mosodium.hash.SHA256_BYTES)
    await mosodium.hash.sha256(Buffer.from('yo'), out)
    await out.readable(r => {
      expect(r.toString('base64'))
        .equals('6QWKsZj2kI9wIRGwwPtbNvmdAFVFIYhsQOKJGzSdx6E=')
    })
  })

  it('should throw on bad sha512 input', async () => {
    try {
      await mosodium.hash.sha512('yo')
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should sha512', async () => {
    const out = await mosodium.SecBuf.insecure(mosodium.hash.SHA512_BYTES)
    await mosodium.hash.sha512(Buffer.from('yo'), out)
    await out.readable(r => {
      expect(r.toString('base64'))
        .equals('dMR97MZP2SEplWf19kZ4YNyRec4ucjBIwYT98v1qMpNkcOzD1jm2lH6Z+cQnNe0gVSvhT9okCErXlicZWso/sQ==')
    })
  })
})
