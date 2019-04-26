const { expect } = require('chai')

const { AsyncClass } = require('../n3h-common')

const { Connection, ConnectionEvent } = require('./index')
const CEvent = ConnectionEvent

/**
 * mock backend for validating "Connection" spec
 */
class ConnectionBackendMock extends AsyncClass {
  /**
   */
  async init () {
    await super.init()

    this.interfaceConnection = this._iface = await new Connection(this)

    this.$pushDestructor(async () => {
      await this._iface.$emitEvent(CEvent.error('yay, cleanup'))
      await this._iface.destroy()
      this._iface = null
    })
  }

  /**
   */
  async bind (bindSpec) {
    await this._iface.$emitEvent(CEvent.bind([bindSpec]))

    // simulate a remote connection
    const con = this._iface.$registerCon('mockCon:in:' + this.$createUid(), '/rem/test/addr')
    await this._iface.$emitEvent(CEvent.connection(con.id))

    // simulate a remote message
    await this._iface.$emitEvent(CEvent.message(con.id, Buffer.from('test-in').toString('base64')))

    // simulate some kind of error
    await this._iface.$emitEvent(CEvent.error('ignore-me'))
  }

  /**
   */
  async connect (conSpec) {
    const con = this._iface.$registerCon('mockCon:out:' + this.$createUid(), conSpec)
    await this._iface.$emitEvent(CEvent.connect(con.id))

    // simulate a remote message
    await this._iface.$emitEvent(CEvent.message(con.id, Buffer.from('test-out').toString('base64')))

    // simulate some kind of error
    await this._iface.$emitEvent(CEvent.conError(con.id, 'ignore-con'))
  }

  /**
   */
  async send (idList, buf) {
    // simulate an echo
    for (let id of idList) {
      await this._iface.$emitEvent(CEvent.message(id, Buffer.concat([
        Buffer.from('echo: '),
        Buffer.from(buf, 'base64')
      ]).toString('base64')))
    }
  }

  /**
   */
  async sendUnreliable (idList, buf) {
    return this.send(idList, buf)
  }

  /**
   */
  async close (id) {
    const data = this._iface.get(id)
    await this._iface.$emitEvent(CEvent.close(id, data))
    this._iface.$removeCon(id)
  }
}

describe('Connection Spec Suite', () => {
  let c

  beforeEach(async () => {
    c = (await new ConnectionBackendMock()).interfaceConnection
  })

  afterEach(async () => {
    await c.destroy()
  })

  it.skip('should not allow bad bind', async () => {
    try {
      await c.bind(42)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should not allow setMeta spec', async () => {
    const b = []
    c.on('connect', c => b.push(['connect', c]))

    await c.connect('test://testConSpec')
    const testId = c.keys().next().value

    expect(() => {
      c.setMeta(testId, { 'spec': 'test' })
    }).throws()
  })

  it('should not throw fns when destroyed', async () => {
    await c.destroy()

    expect(c.has('id')).equals(false)
    c.setMeta('id', {})

    await Promise.all([
      c.$emitEvent(CEvent.bind([])),
      c.$registerCon('id', 'spec'),
      c.$removeCon('id')
    ])
  })

  it('full api', async () => {
    const b = []

    c.on('event', e => b.push(e))

    await c.bind('test://testBindSpec')
    await c.connect('test://testConSpec')
    const testId = c.keys().next().value
    b.push({ type: 'has', data: c.has(testId) })
    b.push({ type: 'has', data: c.has('fake-bad-id') })
    await c.send([testId], Buffer.from('test message').toString('base64'))
    await c.sendUnreliable([testId], Buffer.from('test message').toString('base64'))
    b.push({ type: 'get', data: c.get(testId) })
    await c.setMeta(testId, { test: 'hello' })
    b.push({ type: 'get', data: c.get(testId) })
    await c.send([testId], Buffer.from('test message 2').toString('base64'))
    await c.close(testId)
    await c.destroy()

    // normalize
    const nB = []
    for (let i of b) {
      switch (i.type) {
        case 'has':
          nB.push(['has', i.data])
          break
        case 'get':
          nB.push(['get', i.data.spec, i.data.test])
          break
        case 'error':
          nB.push(['error', i.error])
          break
        case 'conError':
          nB.push(['conError', i.error])
          break
        case 'bind':
          nB.push(['bind', i.boundUriList])
          break
        case 'connection':
          nB.push(['connection'])
          break
        case 'connect':
          nB.push(['connect'])
          break
        case 'message':
          nB.push(['message', Buffer.from(i.buffer, 'base64').toString()])
          break
        case 'close':
          nB.push(['close', i.data.spec])
          break
        default:
          throw new Error('unexpected event type: ' + i.type)
      }
    }

    expect(nB).deep.equals([
      [
        'bind',
        [
          'test://testBindSpec'
        ]
      ],
      [
        'connection'
      ],
      [
        'message',
        'test-in'
      ],
      [
        'error',
        'ignore-me'
      ],
      [
        'connect'
      ],
      [
        'message',
        'test-out'
      ],
      [
        'conError',
        'ignore-con'
      ],
      [
        'has',
        true
      ],
      [
        'has',
        false
      ],
      [
        'message',
        'echo: test message'
      ],
      [
        'message',
        'echo: test message'
      ],
      [
        'get',
        '/rem/test/addr',
        undefined
      ],
      [
        'get',
        '/rem/test/addr',
        'hello'
      ],
      [
        'message',
        'echo: test message 2'
      ],
      [
        'close',
        '/rem/test/addr'
      ],
      [
        'error',
        'yay, cleanup'
      ]
    ])
  })
})
