const { expect } = require('chai')

const Mem = require('./mem').Mem

describe('HackMode Mem Suite', () => {
  let m

  beforeEach(() => {
    m = new Mem()
    m.insert({
      address: 'test1'
    })
    m.insert({
      address: 'test2'
    })
  })

  it('should be a function', () => {
    expect(typeof Mem).equals('function')
  })

  it('should json', () => {
    expect(JSON.stringify(m)).equals('{"test1":{"entry":{"address":"test1"},"meta":[]},"test2":{"entry":{"address":"test2"},"meta":[]}}')
  })

  it('should get', () => {
    expect(m.get('test1')).deep.equals({
      entry: {
        address: 'test1'
      },
      meta: []
    })
  })

  it('should gossip hash hash', () => {
    expect(m.getGossipHashHash()).deep.equals({
      '24': 'I8XwOtgtojmOKzo7qJwSetie154IwJnxJV0HMiVjEY0=',
      '27': 'CNs5L9IOXSl6+PrJ2DXGLJQgMc/yyuyE4Fj4FTkgxQ4='
    })
  })

  it('should gossip list new', () => {
    expect(m.getGossipLocListForGossipHashHash({ 'a': 'fake' })).deep.equals([
      'a'
    ])
  })

  it('should gossip list diff', () => {
    const hh = m.getGossipHashHash()
    const loc = Object.keys(hh)[0]
    hh[loc] = 'fake'
    expect(m.getGossipLocListForGossipHashHash(hh)).deep.equals([
      loc
    ])
  })

  it('should get hashes for diffs', () => {
    const hh = m.getGossipHashHash()
    const loc = Object.keys(hh)[0]
    hh[loc] = 'fake'
    const res = m.getGossipHashesForGossipLocList(m.getGossipLocListForGossipHashHash(hh))
    expect(res).deep.equals([
      'test2'
    ])
  })
})
