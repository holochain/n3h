const mosodium = require('@holochain/mosodium')
const { expect } = require('chai')

const work = require('./work')

describe('work Suite', () => {
  beforeEach(() => {
    mosodium.SecBuf.setLockLevel(mosodium.SecBuf.LOCK_NONE)
  })

  it('should verify good', async () => {
    const key = Buffer.from('916bd248cfbaa608116916a1661f1ed033bc62d81eb0734d8aa46757359685b3', 'hex')
    const nonce = mosodium.SecBuf.from(Buffer.from('97d6f8b7da6dc7212d10f77a01ef2669aefca98e01782cf5dca10e758df39f19', 'hex'))
    expect(await work.verify({ key, nonce })).equals(true)
  })

  it('should not verify bad', async () => {
    const key = Buffer.from('916bd248cfbaa608116916a1661f1ed033bc62d81eb0734d8aa46757359685b3', 'hex')
    const nonce = mosodium.SecBuf.from(Buffer.from('96d6f8b7da6dc7212d10f77a01ef2669aefca98e01782cf5dca10e758df39f19', 'hex'))
    expect(await work.verify({ key, nonce })).equals(false)
  })

  it('should search', async () => {
    const key = Buffer.from('916bd248cfbaa608116916a1661f1ed033bc62d81eb0734d8aa46757359685b3', 'hex')
    const startNonce = '94d6f8b7da6dc7212d10f77a01ef2669aefca98e01782cf5dca10e758df39f19'

    let opCount
    const nonce = await work.search({
      key,
      progress: (count) => {
        opCount = count
      },
      startNonce
    })

    expect(opCount).equals(3)
    expect(nonce).equals('97d6f8b7da6dc7212d10f77a01ef2669aefca98e01782cf5dca10e758df39f19')
  }).timeout(10000)
})
