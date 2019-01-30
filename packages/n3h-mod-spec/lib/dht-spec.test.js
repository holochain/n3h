const { expect } = require('chai')

const { Dht, DhtEvent } = require('./index')
const { AsyncClass } = require('@holochain/n3h-common')

class DhtBackendMock extends AsyncClass {
  async init (spec) {
    await super.init()
    this._spec = spec
  }

  post (evt) {
    this._spec.$emitEvent(evt)
  }

  getPeerLocal () {
    return DhtEvent.peerHoldRequest(
      'abcd',
      'test://',
      'efgh',
      0
    )
  }

  fetchPeer () {
    return DhtEvent.peerHoldRequest(
      'ijkl',
      'test://',
      'mnop',
      0
    )
  }
}

describe('Dht Spec Suite', () => {
  let d = null
  let e = null

  beforeEach(async () => {
    e = []
    d = await new Dht(DhtBackendMock, {})

    d.on('event', evt => e.push(evt))
  })

  afterEach(async () => {
    e = null
    await d.destroy()
  })

  it('should not throw after destroyed', async () => {
    await d.destroy()

    await Promise.all([
      d.$emitEvent(42),
      d.post(null)
    ])
  })

  it('should throw on getPeerLocal after destroyed', async () => {
    await d.destroy()
    try {
      await d.getPeerLocal(null)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on fetchPeer after destroyed', async () => {
    await d.destroy()
    try {
      await d.fetchPeer(null)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on fetchDataLocal after destroyed', async () => {
    await d.destroy()
    try {
      await d.fetchDataLocal(null)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad event emit', async () => {
    try {
      await d.$emitEvent(42)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should throw on bad event post', async () => {
    try {
      await d.post(42)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should emit events', async () => {
    const testBundle = Buffer.from('tst').toString('base64')
    await d.$emitEvent(Dht.DhtEvent.remoteGossipBundle(testBundle, testBundle))
    expect(e[0].bundle).equals('dHN0')
  })

  it('should getPeerLocal', async () => {
    const l = d.getPeerLocal()
    expect(l).deep.equals({
      peerAddress: 'abcd',
      peerData: 'efgh',
      peerTransport: 'test://',
      peerTs: 0,
      type: 'peerHoldRequest'
    })
  })

  it('should getPeerLocal', async () => {
    const l = await d.fetchPeer()
    expect(l).deep.equals({
      peerAddress: 'ijkl',
      peerData: 'mnop',
      peerTransport: 'test://',
      peerTs: 0,
      type: 'peerHoldRequest'
    })
  })

  describe('event in-out', () => {
    const b64 = Buffer.from('tst').toString('base64')
    const b64List = [b64]
    const str = 'str://'
    ;[
      ['remoteGossipBundle', [ b64, b64 ], { fromPeerAddress: b64, bundle: b64 }],
      ['gossipTo', [ b64List, b64 ], { peerList: b64List, bundle: b64 }],
      ['unreliableGossipTo', [ b64List, b64 ], {
        peerList: b64List, bundle: b64 }],
      ['peerHoldRequest', [ b64, str, b64, 42 ], {
        peerAddress: b64, peerTransport: str, peerData: b64, peerTs: 42 }],
      ['dataHoldRequest', [ b64, b64 ], {
        dataAddress: b64, data: b64 }],
      ['dataFetch', [ str, b64 ], { msgId: str, dataAddress: b64 }],
      ['dataFetchResponse', [ str, b64 ], {
        msgId: str, data: b64 }],
      ['dataPrune', [ b64 ], { dataAddress: b64 }]
    ].forEach(val => {
      it('event ' + val[0], async () => {
        await d.$emitEvent(Dht.DhtEvent[val[0]](...val[1]))
        for (let k in val[2]) {
          expect(e[0][k]).deep.equals(val[2][k])
        }
        await d.post(Dht.DhtEvent[val[0]](...val[1]))
        for (let k in val[2]) {
          expect(e[1][k]).deep.equals(val[2][k])
        }
      })
    })
  })
})
