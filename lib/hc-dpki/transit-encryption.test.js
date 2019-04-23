const { expect } = require('chai')

const { TransitEncryption } = require('./transit-encryption')

describe('Transit Encryption Suite', () => {
  it('is a function', () => {
    expect(typeof TransitEncryption).equals('function')
  })

  describe('Basic Tests', async () => {
    let te1 = null
    let te2 = null
    let te3 = null

    let msg = null

    beforeEach(async () => {
      te1 = await new TransitEncryption()
      te2 = await new TransitEncryption()
      te3 = await new TransitEncryption()

      msg = await te1.handshakeStep1(te2.getPubKey())
      msg = await te2.handshakeStep2(te1.getPubKey(), msg)
      await te1.handshakeStep3(te2.getPubKey(), msg)

      msg = await te1.handshakeStep1(te3.getPubKey())
      msg = await te3.handshakeStep2(te1.getPubKey(), msg)
      await te1.handshakeStep3(te3.getPubKey(), msg)
    })

    afterEach(async () => {
      await te1.destroy()
      await te2.destroy()
      await te3.destroy()
      te1 = te2 = te3 = msg = null
    })

    it('reliable sequence', async () => {
      msg = await te1.sendReliable([te2.getPubKey()], Buffer.from('hello'))
      expect((await te2.receiveReliable(msg)).toString()).equals('hello')

      msg = await te1.sendReliable([te2.getPubKey()], Buffer.from('hello2'))
      expect((await te2.receiveReliable(msg)).toString()).equals('hello2')

      msg = await te2.sendReliable([te1.getPubKey()], Buffer.from('hello3'))
      expect((await te1.receiveReliable(msg)).toString()).equals('hello3')

      msg = await te2.sendReliable([te1.getPubKey()], Buffer.from('hello4'))
      expect((await te1.receiveReliable(msg)).toString()).equals('hello4')

      msg = await te1.sendReliable([te3.getPubKey()], Buffer.from('hello5'))
      expect((await te3.receiveReliable(msg)).toString()).equals('hello5')

      msg = await te1.sendReliable([te3.getPubKey()], Buffer.from('hello6'))
      expect((await te3.receiveReliable(msg)).toString()).equals('hello6')
    })

    it('unreliable sequence', async () => {
      msg = await te1.sendUnreliable([te2.getPubKey()], Buffer.from('hello7'))
      expect((await te2.receiveUnreliable(msg)).toString()).equals('hello7')

      msg = await te1.sendUnreliable([te2.getPubKey()], Buffer.from('hello8'))
      expect((await te2.receiveUnreliable(msg)).toString()).equals('hello8')

      msg = await te2.sendUnreliable([te1.getPubKey()], Buffer.from('hello9'))
      expect((await te1.receiveUnreliable(msg)).toString()).equals('hello9')

      msg = await te2.sendUnreliable([te1.getPubKey()], Buffer.from('helloA'))
      expect((await te1.receiveUnreliable(msg)).toString()).equals('helloA')

      msg = await te1.sendUnreliable([te3.getPubKey()], Buffer.from('helloB'))
      expect((await te3.receiveUnreliable(msg)).toString()).equals('helloB')

      msg = await te1.sendUnreliable([te3.getPubKey()], Buffer.from('helloC'))
      expect((await te3.receiveUnreliable(msg)).toString()).equals('helloC')
    })

    it('mixed messaging', async () => {
      msg = await te1.sendReliable([te2.getPubKey()], Buffer.from('mix1'))
      expect((await te2.receiveReliable(msg)).toString()).equals('mix1')

      msg = await te1.sendUnreliable([te2.getPubKey()], Buffer.from('mix2'))
      expect((await te2.receiveUnreliable(msg)).toString()).equals('mix2')

      msg = await te1.sendReliable([te2.getPubKey()], Buffer.from('mix3'))
      expect((await te2.receiveReliable(msg)).toString()).equals('mix3')

      msg = await te1.sendUnreliable([te2.getPubKey()], Buffer.from('mix4'))
      expect((await te2.receiveUnreliable(msg)).toString()).equals('mix4')
    })

    it('unreliable skip ok', async () => {
      msg = await te1.sendUnreliable([te2.getPubKey()], Buffer.from('skip1'))
      expect((await te2.receiveUnreliable(msg)).toString()).equals('skip1')

      await te1.sendUnreliable([te2.getPubKey()], Buffer.from('skip2'))
      await te1.sendUnreliable([te2.getPubKey()], Buffer.from('skip3'))
      await te1.sendUnreliable([te2.getPubKey()], Buffer.from('skip4'))
      await te1.sendUnreliable([te2.getPubKey()], Buffer.from('skip5'))
      await te1.sendUnreliable([te2.getPubKey()], Buffer.from('skip6'))

      msg = await te1.sendUnreliable([te2.getPubKey()], Buffer.from('skip7'))
      expect((await te2.receiveUnreliable(msg)).toString()).equals('skip7')
    })

    it('reliable replay fail', async () => {
      msg = await te1.sendReliable([te2.getPubKey()], Buffer.from('replay1'))
      expect((await te2.receiveReliable(msg)).toString()).equals('replay1')

      try {
        await te2.receiveReliable(msg)
      } catch (e) {
        return
      }

      throw new Error('expected exception, got success')
    })

    it('reliable skip fail', async () => {
      msg = await te1.sendReliable([te2.getPubKey()], Buffer.from('skip1'))
      expect((await te2.receiveReliable(msg)).toString()).equals('skip1')

      await te1.sendReliable([te2.getPubKey()], Buffer.from('skip2'))

      msg = await te1.sendReliable([te2.getPubKey()], Buffer.from('skip3'))

      try {
        await te2.receiveReliable(msg)
      } catch (e) {
        return
      }

      throw new Error('expected exception, got success')
    })

    it('unreliable replay fail', async () => {
      msg = await te1.sendUnreliable([te2.getPubKey()], Buffer.from('replay1'))
      expect((await te2.receiveUnreliable(msg)).toString()).equals('replay1')

      try {
        await te2.receiveUnreliable(msg)
      } catch (e) {
        return
      }

      throw new Error('expected exception, got success')
    })
  })
})
