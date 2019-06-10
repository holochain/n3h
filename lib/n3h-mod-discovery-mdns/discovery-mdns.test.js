const crypto = require('crypto')

const { DiscoveryMdns } = require('./index')

const { $sleep } = require('../n3h-common')

describe('DiscoveryMdns Suite', () => {
  let id = crypto.randomBytes(32).toString('base64')
  let i1 = null
  let i2 = null

  beforeEach(async () => {
    i1 = (await new DiscoveryMdns({
      id,
      port: 45454,
      advertise: 'bla://0.0.0.0'
    })).discoveryInterface
    i1.found = new Set()
    i1.on('event', e => {
      for (let i of e.uriList) {
        i1.found.add(i)
      }
    })

    i2 = (await new DiscoveryMdns({
      id,
      port: 45455,
      advertise: 'bla://0.0.0.0'
    })).discoveryInterface
    i2.found = new Set()
    i2.on('event', e => {
      for (let i of e.uriList) {
        i2.found.add(i)
      }
    })
  })

  afterEach(async () => {
    await i1.destroy()
    await i2.destroy()
  })

  it('should discover within 6 seconds', async () => {
    const start = Date.now()
    while (Date.now() - start < 6000) {
      if (
        i1.found.has('bla://0.0.0.0') &&
        i2.found.has('bla://0.0.0.0')
      ) {
        return
      }
      await $sleep(500)
    }

    throw new Error(JSON.stringify([
      Array.from(i1.found.values()),
      Array.from(i2.found.values())
    ], null, 2))
  }).timeout(8000)
})
