const { expect } = require('chai')

const Mem = require('./mem').Mem

describe('Mock Mem Suite', () => {
  let m

  beforeEach(() => {
    m = new Mem()
    m.insert({
      v: 'test1'
    })
    m.insert({
      v: 'test2'
    })
  })

  it('should be a function', () => {
    expect(typeof Mem).equals('function')
  })

  it('should json', () => {
    expect(JSON.stringify(m)).equals('{"OYAEmbRpxTognzO4iFhiaytimxCxgw43Wdj1AJ4XYJo=":{"v":"test1"},"Nmu2RpmSXt5X5J9DlgV76scoEayztSXYHoRmcjlki+k=":{"v":"test2"}}')
  })

  it('should get', () => {
    expect(m.get('OYAEmbRpxTognzO4iFhiaytimxCxgw43Wdj1AJ4XYJo=')).deep.equals({
      v: 'test1'
    })
  })

  it('should gossip hash hash', () => {
    expect(m.getGossipHashHash()).deep.equals({
      '25': 'AauR62PJpQO/h3s/VsE9EywS2QfpGTs9lMk5G5T3qsY=',
      '53': '1FAPsc4wYjNuokxtnJUlnmk55otWF6Dc1UM7suTf64Q='
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
      'OYAEmbRpxTognzO4iFhiaytimxCxgw43Wdj1AJ4XYJo='
    ])
  })
})
