const { expect } = require('chai')
// const range = require('./range')
const { RangeStore } = require('./range-store')
const defaultConfig = require('./default-config')

const LOC = '20000000'
const RADIUS = '20000000'

describe('Range Store Suite', () => {
  let conf = null
  let rs = null

  beforeEach(async () => {
    conf = await defaultConfig.generateConfigBuilder()
      .finalize()
    rs = await new RangeStore(conf, LOC, RADIUS)
  })

  describe('wouldStore', () => {
    ;[
      ['ffffffff', false],
      ['00000000', true],
      ['3fffffff', true],
      ['40000000', false]
    ].forEach(test => {
      it(test[0] + (test[1] ? '' : ' not') + ' in range', () => {
        expect(rs.wouldStore(test[0])).equals(test[1])
      })
    })
  })

  it('can store', async () => {
    await rs.mayStoreData('00000000', 'test-hash')
    expect((await rs.getHash('test-hash')).loc).equals('00000000')
  })

  it('should prune', async () => {
    await rs.mayStoreData('00000000', 'test-hash', { test: 'zombies' })
    await rs.setRadius(LOC, '000000ff')
    expect((await rs.getHash('test-hash'))).equals(undefined)
  })

  it('hashList', async () => {
    await Promise.all([
      rs.mayStoreData('00000000', '0:a', {}),
      rs.mayStoreData('00000000', '0:b', {}),
      rs.mayStoreData('00000001', '1:a', {}),
      rs.mayStoreData('00000001', '1:b', {})
    ])
    expect(Array.from((await rs.getHashList('00000000', '00000000', 3)).hashSet.values()))
      .deep.equals(['0:a', '0:b'])
    expect(Array.from((await rs.getHashList('00000001', '00000000', 3)).hashSet.values()))
      .deep.equals(['1:a', '1:b'])
    expect(Array.from((await rs.getHashList('00000000', '00000000', 4)).hashSet.values()))
      .deep.equals(['0:a', '0:b', '1:a', '1:b'])
    expect(Array.from((await rs.getHashList('00000001', '00000000', 4)).hashSet.values()))
      .deep.equals(['1:a', '1:b', '0:a', '0:b'])
  })

  it('hashList wrap', async () => {
    await Promise.all([
      rs.mayStoreData('00000000', 'a', {}),
      rs.mayStoreData('30000000', 'b', {})
    ])
    expect(Array.from((await rs.getHashList('00000001', '00000000')).hashSet.values()))
      .deep.equals(['b', 'a'])
    expect(Array.from((await rs.getHashList('00000001', '30000000')).hashSet.values()))
      .deep.equals(['b'])
  })
})
