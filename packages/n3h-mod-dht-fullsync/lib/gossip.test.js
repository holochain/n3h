const gossip = require('./gossip')
const { expect } = require('chai')

const HASH_1 = 'N/LMF6pIxY6seNdVtieTnCEOCsDlzFD0FYbYMRoqndM='
const HASH_2 = 'p6LMqqpKxY6setdVtiqTnCEOCsrlzFCkFYaoMRqqnaM='
const AGENT_1 = 'HkY7aie8zrakLWKjqNAqbw1zZTIVdx3iQ6Y6wEihi1naKVV-I9c0byE-xaI3E7KiSX7vNTVNW1IIisalmTpf2wkeeIdQWQbR'
const AGENT_2 = 'HkZ2jf8S4-Cgp40WLQEeAAa0IvPkoel5jqWtmhpPt07ONjsf_LnS8o0EUk5wHcmvKhYx1Jo6za3uIHOt2SEJgZN4HuU3ukg2'

describe('gossip binary encoding Suite', () => {
  it('should encode / decode locHashes', () => {
    const m = new Map()
    m.set(1, HASH_1)
    m.set(2, HASH_2)
    const res = gossip.parse(gossip.locHashes(m))
    expect(res.type).equals('locHashes')
    expect(res.map.get('1')).equals(HASH_1)
    expect(res.map.get('2')).equals(HASH_2)
  })

  it('should encode / decode hashDiff', () => {
    const res = gossip.parse(gossip.hashDiff(
      [AGENT_1, AGENT_2], [HASH_1, HASH_2], [1, 2, 42]
    ))
    expect(res.type).equals('hashDiff')
    expect(res.peerAddressList[0]).equals(AGENT_1)
    expect(res.peerAddressList[1]).equals(AGENT_2)
    expect(res.dataAddressList[0]).equals(HASH_1)
    expect(res.dataAddressList[1]).equals(HASH_2)
    expect(res.requestLocs[0]).equals('1')
    expect(res.requestLocs[1]).equals('2')
    expect(res.requestLocs[2]).equals('42')
  })
})
