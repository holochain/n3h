const { expect } = require('chai')
const msg = require('./msg-types')

describe('msg-types Suite', () => {
  it('should have server id', () => {
    expect(msg.SRV_ID.toString('hex')).equals('24242424')
  })

  it('should convert ping', () => {
    const enc = msg.encode('ping', {
      sent: 42
    })

    const res = msg.decode(enc.name, enc.data)

    expect(res.name).equals('ping')
    expect(res.data).deep.equals({
      sent: 42
    })
  })

  it('should convert pong', () => {
    const enc = msg.encode('pong', {
      orig: 42,
      recv: 88
    })

    const res = msg.decode(enc.name, enc.data)

    expect(res.name).equals('pong')
    expect(res.data).deep.equals({
      orig: 42,
      recv: 88
    })
  })

  it('should convert json', () => {
    const enc = msg.encode('json', {
      test: 'hello'
    })

    const res = msg.decode(enc.name, enc.data)

    expect(res.name).equals('json')
    expect(res.data).deep.equals({
      test: 'hello'
    })
  })

  it('should convert namedBinary', () => {
    const enc = msg.encode('namedBinary', {
      name: Buffer.from('hello', 'utf8'),
      data: Buffer.from('a', 'utf8')
    })

    const res = msg.decode(enc.name, enc.data)

    expect(res.name).equals('namedBinary')
    expect(res.data.name.toString('utf8')).equals('hello')
    expect(res.data.data.toString('utf8')).equals('a')
  })
})
