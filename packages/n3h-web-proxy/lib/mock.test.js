const { expect } = require('chai')

const { Connection } = require('./mock')

describe('mock Suite', () => {
  it('hey?', async () => {
    const c = await new Connection()

    const b = []

    c.on('error', e => b.push(['error', e]))
    c.on('bind', s => b.push(['bind', s]))
    c.on('connect', c => b.push(['connect', c]))
    c.on('connection', c => b.push(['connection', c]))
    c.on('message', (c, buf) => b.push(['message', c, buf]))
    c.on('close', c => b.push(['close', c]))

    await c.bind('testBindSpec')
    const testId = b[1][1].id
    await c.connect('testConSpec')
    await c.send(testId, Buffer.from('test message'))
    await c.setMeta(testId, { test: 'hello' })
    await c.send(testId, Buffer.from('test message 2'))
    await c.close(testId)

    // normalize
    for (let i of b) {
      if (typeof i[1] === 'object' && i[1].id) {
        delete i[1].id
      }
      if (i[0] === 'message') {
        i[2] = i[2].toString()
      } else if (i[0] === 'error') {
        i[1] = i[1].toString()
      }
    }

    expect(b).deep.equals([
      [
        'bind',
        'testBindSpec'
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
        'message',
        {
          'spec': '/rem/test/addr'
        },
        'echo: test message'
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
      ]
    ])
  })
})
