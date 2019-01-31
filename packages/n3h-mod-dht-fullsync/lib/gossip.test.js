const gossip = require('./gossip')
const { expect } = require('chai')

const AGENT_ADD_1 = 'hkY7aie8zrakLWKjqNAqbw1zZTIVdx3iQ6Y6wEihi1naKVV-I9c0byE-xaI3E7KiSX7vNTVNW1IIisalmTpf2wkeeIdQWQbR'
const AGENT_ADD_2 = 'hkZ2jf8S4-Cgp40WLQEeAAa0IvPkoel5jqWtmhpPt07ONjsf_LnS8o0EUk5wHcmvKhYx1Jo6za3uIHOt2SEJgZN4HuU3ukg2'

const TS_1 = 1548363711960
const TS_2 = 1548000000000

const HASH_1 = 'N/LMF6pIxY6seNdVtieTnCEOCsDlzFD0FYbYMRoqndM='
const HASH_2 = 'p6LMqqpKxY6setdVtiqTnCEOCsrlzFCkFYaoMRqqnaM='
const HASH_3 = 'pF+blnvCisgVmYNo+KWWjLaA+bTl6S9Cp7EVt8D6ZYo='
const HASH_4 = 'jRDdrI+LsPeQRl1utEbztmdTKe8uuC5Pypy/5L2lsnc='
const HASH_5 = 'd/V/DrhVE8p3q6l9KghcxPhsnob6VrB3kqcWDsVyBsY='

describe('gossip binary encoding Suite', () => {
  it('should encode / decode locHashes', () => {
    const m = new Map()
    m.set(1, HASH_1)
    m.set(2, HASH_2)
    const res = gossip.parse(gossip.locHashes('borg', {
      1: HASH_1,
      2: HASH_2
    }))
    expect(res.type).equals('locHashes')
    expect(res.msgId).equals('borg')
    expect(res.map.get('1')).equals(HASH_1)
    expect(res.map.get('2')).equals(HASH_2)
  })

  it('should encode / decode hashDiff', () => {
    const res = gossip.parse(gossip.hashDiff('froop', {
      [AGENT_ADD_1]: TS_1,
      [AGENT_ADD_2]: TS_2
    }, {
      [HASH_1]: [HASH_2, HASH_3],
      [HASH_4]: [HASH_5]
    }, [
      1, 2, 42
    ]))

    expect(res.type).equals('hashDiff')
    expect(res.msgId).equals('froop')

    expect(res.peerAddressToTsMap.size).equals(2)
    expect(res.peerAddressToTsMap.get(AGENT_ADD_1)).equals(TS_1)
    expect(res.peerAddressToTsMap.get(AGENT_ADD_2)).equals(TS_2)

    expect(res.dataAddressToHashListMap.size).equals(2)
    expect(res.dataAddressToHashListMap.get(HASH_1)).deep.equals([
      HASH_2, HASH_3])
    expect(res.dataAddressToHashListMap.get(HASH_4)).deep.equals([
      HASH_5])

    expect(res.requestLocList).deep.equals(['1', '2', '42'])
  })

  it('should encode / decode hashDiffResp', () => {
    const res = gossip.parse(gossip.hashDiffResp('squee', {
      [AGENT_ADD_1]: TS_1,
      [AGENT_ADD_2]: TS_2
    }, {
      [HASH_1]: [HASH_2, HASH_3],
      [HASH_4]: [HASH_5]
    }))

    expect(res.type).equals('hashDiffResp')
    expect(res.msgId).equals('squee')

    expect(res.peerAddressToTsMap.size).equals(2)
    expect(res.peerAddressToTsMap.get(AGENT_ADD_1)).equals(TS_1)
    expect(res.peerAddressToTsMap.get(AGENT_ADD_2)).equals(TS_2)

    expect(res.dataAddressToHashListMap.size).equals(2)
    expect(res.dataAddressToHashListMap.get(HASH_1)).deep.equals([
      HASH_2, HASH_3])
    expect(res.dataAddressToHashListMap.get(HASH_4)).deep.equals([
      HASH_5])
  })

  it('should encode / decode fetchAddressList', () => {
    const res = gossip.parse(gossip.fetchAddressList('vvvooom', [
      AGENT_ADD_1, AGENT_ADD_2
    ], [
      HASH_1, HASH_2
    ]))

    expect(res.type).equals('fetchAddressList')
    expect(res.msgId).equals('vvvooom')

    expect(res.peerAddressList).deep.equals([ AGENT_ADD_1, AGENT_ADD_2 ])
    expect(res.dataAddressList).deep.equals([ HASH_1, HASH_2 ])
  })
})
