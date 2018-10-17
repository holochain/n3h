const { expect } = require('chai')

const mosodium = require('mosodium')

const seed = require('./seed')

// speed up the unit tests
seed.pwhashOpslimit = mosodium.pwhash.OPSLIMIT_INTERACTIVE
seed.pwhashMemlimit = mosodium.pwhash.MEMLIMIT_INTERACTIVE

const { RootSeed } = require('./index')

describe('seed Suite', () => {
  it('should initialize with a SecBuf', async () => {
    const seed = new mosodium.SecBuf(32, mosodium.SecBuf.LOCK_NONE)
    seed.randomize()
    const rs = await new RootSeed(seed)
    expect(rs.getMnemonic().split(/\s/g).length).equals(24)
    await rs.destroy()
  })

  it('should work with static newRandom', async () => {
    const rs = await RootSeed.newRandom()
    expect(rs.getMnemonic().split(/\s/g).length).equals(24)
    await rs.destroy()
  })

  it('should work with a mnemonic', async () => {
    const rs1 = await RootSeed.newRandom()
    const mn1 = rs1.getMnemonic()
    const rs2 = await new RootSeed(mn1)
    const mn2 = rs2.getMnemonic()
    expect(mn2.split(/\s/g).length).equals(24)
    expect(mn1).equals(mn2)
    await rs1.destroy()
    await rs2.destroy()
  })

  describe('device seed subsuite', () => {
    let seed = null
    let rs = null
    let ds = null

    beforeEach(async () => {
      seed = new mosodium.SecBuf(32, mosodium.SecBuf.LOCK_NONE)
      rs = await new RootSeed(seed)
      ds = await rs.getDeviceSeed(384, '123456')
    })

    afterEach(async () => {
      await Promise.all([
        rs.destroy(),
        ds.destroy()
      ])
    })

    it('should derive device seed', async () => {
      expect(ds.getMnemonic()).equals('adjust copper neither clap panther bicycle hero pitch daughter pelican judge holiday aisle tooth logic feel urban ranch number deny spin shoe correct hunt')
    })

    it('should derive application keypair', async () => {
      const kp = await ds.getApplicationKeypair(1952)
      expect(kp.getId()).equals('2Q79zxkpezKLNVEtOc+nP/1Gzg8viiVLiSriJ66dnfbIlIX4rPXwRQuGXwuOZ/o9n2diguYVjFYD063iG7wofvKG')
      await kp.destroy()
    })
  })
})
