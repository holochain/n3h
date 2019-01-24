const { expect } = require('chai')

const { Dht, DhtEvent } = require('@holochain/n3h-mod-spec')
const { DhtBackendFullsync } = require('./index')

const TEST_URI_1 = 'fake://some/place'

const TEST_DATA = {
  D1: Buffer.from('tst').toString('base64'),
  D2: Buffer.from('test data #2').toString('base64')
}

describe('DhtBackendFullsync Suite', () => {
  let d = null

  beforeEach(async () => {
    d = await new Dht(DhtBackendFullsync, {
      thisPeer: DhtEvent.peerHoldRequest(
        'test', 'yo://', '', Date.now())
    })
    d.on('event', evt => {
      switch (evt.type) {
        case 'dataFetch':
          let data = null
          if (evt.dataAddress in TEST_DATA) {
            data = TEST_DATA[evt.dataAddress]
          }
          d.post(Dht.DhtEvent.dataFetchResponse(
            evt.msgId, data))
          break
        case 'gossipTo':
          console.log('ignoring gossipTo for now')
          break
        default:
          throw new Error('unexpected event type: ' + evt.type + ' : ' + JSON.stringify(evt))
      }
    })
  })

  afterEach(async () => {
    await d.destroy()
  })

  it('tmp', async () => {
    const addr = 'D1'

    d.post(Dht.DhtEvent.dataHoldRequest(addr, TEST_DATA[addr]))
    d.post(Dht.DhtEvent.peerHoldRequest(
      'agentId', TEST_URI_1, TEST_DATA[addr], Date.now()))
    await d._backend._exec.drain()

    const peer = d.getPeerLocal('agentId')
    expect(peer.peerTransport).equals(TEST_URI_1)
    expect(peer.peerData).equals(TEST_DATA[addr])

    const data = await d.fetchDataLocal(addr)
    expect(data).equals(TEST_DATA[addr])

    expect(true).equals(true)
  })
})
