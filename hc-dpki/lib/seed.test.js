const { expect } = require('chai')

const mosodium = require('mosodium')

const util = require('./util')

// speed up the unit tests
util.pwhashOpslimit = mosodium.pwhash.OPSLIMIT_INTERACTIVE
util.pwhashMemlimit = mosodium.pwhash.MEMLIMIT_INTERACTIVE

const { Seed, RootSeed, DeviceSeed, DevicePinSeed } = require('./index')

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

  it('should bundle / restore', async () => {
    const rs = await RootSeed.newRandom()
    const m = rs.getMnemonic()
    const b = await rs.getBundle(mosodium.SecBuf.from(Buffer.from('hello')), 'hola')
    await rs.destroy()
    expect(b.hint).equals('hola')
    expect(b.type).equals('hcRootSeed')
    const rs2 = await Seed.fromBundle(
      b, mosodium.SecBuf.from(Buffer.from('hello')))
    expect(rs2.getMnemonic()).equals(m)
    expect(rs2 instanceof RootSeed).equals(true)
    await rs2.destroy()
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
    let dps = null

    beforeEach(async () => {
      seed = new mosodium.SecBuf(32, mosodium.SecBuf.LOCK_NONE)
      rs = await new RootSeed(seed)
      ds = await rs.getDeviceSeed(384)
      dps = await ds.getDevicePinSeed('123456')
    })

    afterEach(async () => {
      await Promise.all([
        rs.destroy(),
        ds.destroy(),
        dps.destroy()
      ])
    })

    it('should derive device seed', async () => {
      expect(ds.getMnemonic()).equals('cushion surge candy struggle hurry cat dilemma human early when gospel input february shop grant capital input seat autumn cement vicious then code melt')
    })

    it('should derive application keypair', async () => {
      const kp = await dps.getApplicationKeypair(1952)
      expect(kp.getId()).equals('2Q79zxkpezKLNVEtOc-nP_1Gzg8viiVLiSriJ66dnfbIlIX4rPXwRQuGXwuOZ_o9n2diguYVjFYD063iG7wofvKG')
      await kp.destroy()
    })

    it('should bundle / restore', async () => {
      const m = ds.getMnemonic()
      const b = await ds.getBundle(mosodium.SecBuf.from(Buffer.from('hello')), 'hola')
      expect(b.hint).equals('hola')
      expect(b.type).equals('hcDeviceSeed')
      const ds2 = await Seed.fromBundle(
        b, mosodium.SecBuf.from(Buffer.from('hello')))
      expect(ds2.getMnemonic()).equals(m)
      expect(ds2 instanceof DeviceSeed).equals(true)
      await ds2.destroy()
    })

    it('should bundle / restore (pin seed)', async () => {
      const m = dps.getMnemonic()
      const b = await dps.getBundle(mosodium.SecBuf.from(Buffer.from('hello')), 'hola')
      expect(b.hint).equals('hola')
      expect(b.type).equals('hcDevicePinSeed')
      const dps2 = await Seed.fromBundle(
        b, mosodium.SecBuf.from(Buffer.from('hello')))
      expect(dps2.getMnemonic()).equals(m)
      expect(dps2 instanceof DevicePinSeed).equals(true)
      await dps2.destroy()
    })
  })
})
