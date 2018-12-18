const { expect } = require('chai')
// const range = require('./range')
const { RangeStore } = require('./range-store')
const defaultConfig = require('./default-config')

const LOC = 0x20000000
const RADIUS = 0x20000000

describe('Range Store Suite', () => {
  let conf = null
  let rs = null

  before(async () => {
    conf = await defaultConfig.generateConfigBuilder()
      .finalize()
  })

  beforeEach(async () => {
    rs = await new RangeStore(conf, LOC, RADIUS)
  })

  describe('wouldStore', () => {
    ;[
      [-1, false],
      [0, true],
      [0x40000000, true],
      [0x40000001, false]
    ].forEach(test => {
      it(test[0] + (test[1] ? '' : ' not') + ' in range', () => {
        expect(rs.wouldStore(test[0])).equals(test[1])
      })
    })
  })

  it('can store', async () => {
    await rs.mayStoreData(0, 'test-hash', { test: 'zombies' })
    expect((await rs.getHash('test-hash')).test).equals('zombies')
  })

  it('should prune', async () => {
    await rs.mayStoreData(0, 'test-hash', { test: 'zombies' })
    await rs.setRadius(LOC, 100)
    expect((await rs.getHash('test-hash'))).equals(undefined)
  })
})
