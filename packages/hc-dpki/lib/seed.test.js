const { expect } = require('chai')

const mosodium = require('@holochain/mosodium')
mosodium.SecBuf.setLockLevel(mosodium.SecBuf.LOCK_NONE)

const util = require('./util')

// speed up the unit tests
util.pwhashOpslimit = mosodium.pwhash.OPSLIMIT_INTERACTIVE
util.pwhashMemlimit = mosodium.pwhash.MEMLIMIT_INTERACTIVE

const { Seed, RootSeed, DeviceSeed, DevicePinSeed } = require('./index')

describe('seed Suite', () => {
  it('should initialize with a SecBuf', async () => {
    const seed = new mosodium.SecBuf(32)
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

  it('should throw on bad bundle hint', async () => {
    const rs = await RootSeed.newRandom()
    try {
      await rs.getBundle(mosodium.SecBuf.from(Buffer.from('hello')))
    } catch (e) {
      await rs.destroy()
      return
    }
    await rs.destroy()
    throw new Error('expected exception, got success')
  })

  it('should throw on bad bundle type', async () => {
    try {
      await Seed.fromBundle({
        type: 'badBundleType'
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad init type', async () => {
    try {
      await new Seed(2)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad mnemonic string', async () => {
    try {
      await new Seed('hcRootSeed')
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad mnemonic string (validate)', async () => {
    try {
      await new Seed('hcRootSeed', 'a a a a a a a a a a a a a a a a a a a a a a a a')
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
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
      seed = new mosodium.SecBuf(32)
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

    it('should throw on bad device seed index', async () => {
      try {
        await rs.getDeviceSeed('a')
      } catch (e) {
        return
      }
      throw new Error('expected exception, got success')
    })

    it('should throw on bad device seed pin', async () => {
      try {
        await ds.getDevicePinSeed('a')
      } catch (e) {
        return
      }
      throw new Error('expected exception, got success')
    })

    it('should derive application keypair', async () => {
      const kp = await dps.getApplicationKeypair(1952)
      expect(kp.getId()).equals('hkbZDv3PGSl7Mos1US05z6c__UbODy-KJUuJKuInrp2d9siUhfis9fBFC4ZfC45n-j2fZ2KC5hWMVgPTreIbvCh-9mM_1RO2')
      await kp.destroy()
    })

    it('should throw on bad application keypair index', async () => {
      try {
        await dps.getApplicationKeypair('a')
      } catch (e) {
        return
      }
      throw new Error('expected exception, got success')
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
