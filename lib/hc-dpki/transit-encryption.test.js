const { expect } = require('chai')

const { TransitEncryption } = require('./transit-encryption')

describe('Transit Encryption Suite', () => {
  it('is a function', () => {
    expect(typeof TransitEncryption).equals('function')
  })

  it('sanity', async () => {
    const [te1, te2, te3] = await Promise.all([
      new TransitEncryption(),
      new TransitEncryption(),
      new TransitEncryption()
    ])

    let msg = null

    msg = await te1.handshakeStep1(te2.getPubKey())
    msg = await te2.handshakeStep2(te1.getPubKey(), msg)
    await te1.handshakeStep3(te2.getPubKey(), msg)

    msg = await te1.handshakeStep1(te3.getPubKey())
    msg = await te3.handshakeStep2(te1.getPubKey(), msg)
    await te1.handshakeStep3(te3.getPubKey(), msg)

    // -- reliable -- //

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

    // -- unreliable -- //

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

    await Promise.all([
      te1.destroy(),
      te2.destroy(),
      te3.destroy()
    ])
  })
})
