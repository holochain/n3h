const { expect } = require('chai')
const { Connection } = require('./spec')
const { ConnectionBackendWss } = require('./wss-connection')
const { $sleep } = require('@holochain/n3h-common')

describe('Wss Connection Suite', () => {
  it('full api', async () => {
    const c = await new Connection(ConnectionBackendWss, {
      rsaBits: 1024
    })

    const b = []

    const waitSend = async (id, buf) => {
      let bidx = b.length
      await c.send(id, buf)
      for (;;) {
        await $sleep(10)
        for (let i = bidx; i < b.length; ++i) {
          if (b[i][0] === 'message') {
            return
          }
        }
      }
    }

    c.on('error', e => b.push(['error', e]))
    c.on('bind', s => b.push(['bind', s]))
    c.on('connect', c => b.push(['connect', c]))
    c.on('connection', c => b.push(['connection', c]))
    c.on('message', (c, buf) => b.push(['message', c, buf]))
    c.on('close', c => b.push(['close', c]))

    await c.bind('wss://0.0.0.0:0/hello-test')

    const srvAddr = b[0][1][0]

    await c.connect(srvAddr)

    const con1 = b[1][1].id
    const con2 = b[2][1].id

    await waitSend(con1, Buffer.from('test1'))
    await waitSend(con2, Buffer.from('test2'))

    await c.close(con1)

    await (async () => {
      for (;;) {
        await $sleep(10)
        for (let i of b) {
          if (i[0] === 'close' && i[1].spec === srvAddr) {
            return
          }
        }
      }
    })()

    await c.destroy()

    expect(b.map(b => b[0])).deep.equals([
      'bind',
      'connection',
      'connect',
      'message',
      'message',
      'close',
      'close'
    ])
  })
})
