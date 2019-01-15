const { expect } = require('chai')

const { AsyncClass } = require('@holochain/n3h-common')

const { Connection } = require('./index')

/**
 */
class ConnectionBackendMock extends AsyncClass {
  /**
   */
  async init (spec) {
    await super.init()

    this._spec = spec

    this.$pushDestructor(async () => {
      await this._spec.$emitError(new Error('yay, cleanup'))
      this._spec = null
    })
  }

  /**
   */
  async bind (bindSpec) {
    await this._spec.$emitBind([bindSpec])

    // simulate a remote connection
    const con = this._spec.$registerCon('mockCon:in:' + this.$createUid(), '/rem/test/addr')
    await this._spec.$emitConnection(con.id)

    // simulate a remote message
    await this._spec.$emitMessage(con.id, Buffer.from('test-in'))

    // simulate some kind of error
    await this._spec.$emitError(new Error('ignore-me'))
  }

  /**
   */
  async connect (conSpec) {
    const con = this._spec.$registerCon('mockCon:out:' + this.$createUid(), conSpec)
    await this._spec.$emitConnect(con.id)

    // simulate a remote message
    await this._spec.$emitMessage(con.id, Buffer.from('test-out'))

    // simulate some kind of error
    await this._spec.$emitConError(con.id, new Error('ignore-con'))
  }

  /**
   */
  async send (id, buf) {
    // simulate an echo
    await this._spec.$emitMessage(id, Buffer.concat([
      Buffer.from('echo: '),
      buf
    ]))
  }

  /**
   */
  async close (id) {
    await this._spec.$emitClose(id)
    this._spec.$removeCon(id)
  }
}

describe('mock Suite', () => {
  let c

  beforeEach(async () => {
    c = await new Connection(ConnectionBackendMock)
  })

  afterEach(async () => {
    await c.destroy()
  })

  it('should not allow bad bind', async () => {
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

    await c.connect('testConSpec')
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
      c.$emitError(new Error('test')),
      c.$emitConError('id', new Error('test')),
      c.$emitBind([]),
      c.$emitConnect('id'),
      c.$emitConnection('id'),
      c.$emitMessage('id', Buffer.alloc(0)),
      c.$emitClose('id'),
      c.$registerCon('id', 'spec'),
      c.$removeCon('id')
    ])
  })

  it('full api', async () => {
    const b = []

    c.on('error', e => b.push(['error', e]))
    c.on('conError', (c, e) => b.push(['conError', c, e]))
    c.on('bind', s => b.push(['bind', s]))
    c.on('connect', c => b.push(['connect', c]))
    c.on('connection', c => b.push(['connection', c]))
    c.on('message', (c, buf) => b.push(['message', c, buf]))
    c.on('close', c => b.push(['close', c]))

    await c.bind('testBindSpec://')
    await c.connect('testConSpec')
    const testId = c.keys().next().value
    b.push(['has', c.has(testId)])
    b.push(['has', c.has('fake-bad-id')])
    await c.send(testId, Buffer.from('test message'))
    b.push(['get', c.get(testId)])
    await c.setMeta(testId, { test: 'hello' })
    b.push(['get', c.get(testId)])
    await c.send(testId, Buffer.from('test message 2'))
    await c.close(testId)
    await c.destroy()

    // normalize
    for (let i of b) {
      if (typeof i[1] === 'object' && i[1].id) {
        delete i[1].id
      }
      if (i[0] === 'message') {
        i[2] = i[2].toString()
      } else if (i[0] === 'error') {
        i[1] = i[1].toString()
      } else if (i[0] === 'conError') {
        i[2] = i[2].toString()
      }
    }

    expect(b).deep.equals([
      [
        'bind',
        [
          'testBindSpec://'
        ]
      ],
      [
        'connection',
        {
          'spec': '/rem/test/addr'
        }
      ],
      [
        'message',
        {
          'spec': '/rem/test/addr'
        },
        'test-in'
      ],
      [
        'error',
        'Error: ignore-me'
      ],
      [
        'connect',
        {
          'spec': 'testConSpec'
        }
      ],
      [
        'message',
        {
          'spec': 'testConSpec'
        },
        'test-out'
      ],
      [
        'conError',
        {
          'spec': 'testConSpec'
        },
        'Error: ignore-con'
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
        {
          'spec': '/rem/test/addr'
        },
        'echo: test message'
      ],
      [
        'get',
        {
          'spec': '/rem/test/addr'
        }
      ],
      [
        'get',
        {
          'spec': '/rem/test/addr',
          'test': 'hello'
        }
      ],
      [
        'message',
        {
          'spec': '/rem/test/addr',
          'test': 'hello'
        },
        'echo: test message 2'
      ],
      [
        'close',
        {
          'spec': '/rem/test/addr',
          'test': 'hello'
        }
      ],
      [
        'error',
        'Error: yay, cleanup'
      ]
    ])
  })
})
