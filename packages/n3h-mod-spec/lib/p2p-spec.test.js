const { expect } = require('chai')

const { P2p, P2pEvent } = require('./index')
const { AsyncClass, $sleep } = require('@holochain/n3h-common')

class P2pBackendMock extends AsyncClass {
  async init (spec, initOptions) {
    await super.init()

    this._spec = spec
    this.e = initOptions.e
  }

  getId () { return 'test-id' }
  getAdvertise () { return 'test://' }
  transportConnect (uri) { this.e.push('con:' + uri) }
  publishReliable (list, data) {
    this.e.push({
      t: 'publishReliable',
      list,
      data
    })
  }
  publishUnreliable (list, data) {
    this.e.push({
      t: 'publishUnreliable',
      list,
      data
    })
  }
  requestReliable (msgId, list, data) {
    return this._spec.$emitEvent(P2pEvent.message('abcd', msgId, 'efgh'))
  }
  respondReliable (msgId, fromPeerAddress, data) {
    this._spec.$checkResolveRequest(P2pEvent.message(
      fromPeerAddress, msgId, data))
  }
}

describe('P2p Spec Suite', () => {
  let p = null
  let e = null

  beforeEach(async () => {
    e = []
    p = await new P2p(P2pBackendMock, { e })

    p.on('event', evt => e.push(evt))
  })

  afterEach(async () => {
    e = null
    await p.destroy()
  })

  it('should not throw after destroyed', async () => {
    await p.destroy()

    p.getId()
    p.getAdvertise()

    await Promise.all([
      p.$emitEvent(42),
      p.transportConnect('bla://'),
      p.publishReliable([], 'abcd'),
      p.publishUnreliable([], 'abcd'),
      p.requestReliable([], 'abcd'),
      p.$checkResolveRequest(null)
    ])
  })

  it('should throw on bad event emit', async () => {
    try {
      await p.$emitEvent(42)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should emit message', async () => {
    const b64 = Buffer.from('tst').toString('base64')
    await p.$emitEvent(P2pEvent.message(b64, b64, b64))
    expect(e[0].data).equals('dHN0')
  })

  it('should return id', async () => {
    expect(p.getId()).equals('test-id')
  })

  it('should return advertise', async () => {
    expect(p.getAdvertise()).equals('test://')
  })

  it('should transportConnect', async () => {
    await p.transportConnect('bla://')
    expect(e[0]).equals('con:bla://')
  })

  it('should publishReliable', async () => {
    await p.publishReliable(['abcd'], 'efgh')
    expect(e[0]).deep.equals({
      t: 'publishReliable',
      list: ['abcd'],
      data: 'efgh'
    })
  })

  it('should publishUnreliable', async () => {
    await p.publishUnreliable(['abcd'], 'efgh')
    expect(e[0]).deep.equals({
      t: 'publishUnreliable',
      list: ['abcd'],
      data: 'efgh'
    })
  })

  it('should requestReliable', async () => {
    const promise = p.requestReliable(['abcd'], 'efgh')
    await $sleep(0)
    expect(e[0].fromPeerAddress).equals('abcd')
    expect(e[0].data).equals('efgh')
    await p.respondReliable(e[0].msgId, 'ijkl')
    const res = await promise
    expect(res).equals('ijkl')
  })
})
