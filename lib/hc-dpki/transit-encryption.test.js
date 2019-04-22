const { expect } = require('chai')

const { TransitEncryption } = require('./transit-encryption')

describe('Transit Encryption Suite', () => {
  it('is a function', () => {
    expect(typeof TransitEncryption).equals('function')
  })

  it('sanity', async () => {
    const [te1, te2] = await Promise.all([
      new TransitEncryption(),
      new TransitEncryption()
    ])

    const intro = await te1.createIntroduction(te2.getPubKey())
    console.log(intro)

    await Promise.all([
      te1.destroy(),
      te2.destroy()
    ])
  })
})
