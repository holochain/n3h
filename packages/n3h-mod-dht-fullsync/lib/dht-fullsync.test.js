const { expect } = require('chai')

const { Dht } = require('@holochain/n3h-mod-spec')
const { DhtBackendFullsync } = require('./index')

const TEST_DATA_1 = Buffer.from('tst').toString('base64')

describe('DhtBackendFullsync Suite', () => {
  let d = null

  beforeEach(async () => {
    d = await new Dht(DhtBackendFullsync, {
    })
  })

  afterEach(async () => {
    await d.destroy()
  })

  it('tmp', async () => {
    d.post(Dht.DhtEvent.dataHoldRequest('testAddr', TEST_DATA_1))
    d.post(Dht.DhtEvent.peerHoldRequest(
      'agentId', TEST_DATA_1, TEST_DATA_1, Date.now()))
    await d._backend._exec.drain()
    expect(true).equals(true)
  })
})
