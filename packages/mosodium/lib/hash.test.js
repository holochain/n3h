const expect = require('chai').expect
const sodium = require('./index')

describe('hash Suite', () => {
  before(() => {
    sodium.SecBuf.setLockLevel(sodium.SecBuf.LOCK_NONE)
  })

  it('should throw on bad sha256 input', () => {
    expect(() => sodium.hash.sha256('yo')).throws()
  })

  it('should sha256', () => {
    expect(sodium.hash.sha256(Buffer.from('yo')).toString('base64'))
      .equals('6QWKsZj2kI9wIRGwwPtbNvmdAFVFIYhsQOKJGzSdx6E=')
  })

  it('should throw on bad sha512 input', () => {
    expect(() => sodium.hash.sha512('yo')).throws()
  })

  it('should sha512', () => {
    expect(sodium.hash.sha512(Buffer.from('yo')).toString('base64'))
      .equals('dMR97MZP2SEplWf19kZ4YNyRec4ucjBIwYT98v1qMpNkcOzD1jm2lH6Z+cQnNe0gVSvhT9okCErXlicZWso/sQ==')
  })

  it('should toInt a 256 bit hash', () => {
    expect(sodium.hash.toInt(Buffer.from('6QWKsZj2kI9wIRGwwPtbNvmdAFVFIYhsQOKJGzSdx6E=', 'base64'))).equals(999746057)
  })

  it('should toInt a 512 bit hash', () => {
    expect(sodium.hash.toInt(Buffer.from('dMR97MZP2SEplWf19kZ4YNyRec4ucjBIwYT98v1qMpNkcOzD1jm2lH6Z+cQnNe0gVSvhT9okCErXlicZWso/sQ==', 'base64'))).equals(-1585257654)
  })

  it('should throw on bad toInt input', () => {
    expect(() => {
      sodium.hash.toInt()
    }).throws()
  })

  it('should throw on bad toInt input length', () => {
    expect(() => {
      sodium.hash.toInt(Buffer.alloc(7))
    }).throws()
  })
})
