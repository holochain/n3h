const { expect } = require('chai')
const { Connection } = require('@holochain/n3h-mod-spec')
const { ConnectionBackendWss } = require('./index')
const { $sleep } = require('@holochain/n3h-common')

describe('Wss Connection Suite', () => {
  it('full api', async () => {
    const now = Date.now()
    const lstep = (...args) => {
      const ts = Date.now() - now
      console.log('[' + ts + ' ms]', ...args)
    }
    for (let t = 200; t < 1800; t += 200) {
      setTimeout(() => { lstep('time tick ' + t) }, t)
    }

    const c = await new Connection(ConnectionBackendWss, {
      passphrase: 'hello',
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

    lstep('bind')
    await c.bind('wss://0.0.0.0:0/hello-test')

    const srvAddr = b[0][1][0]

    lstep('connect')
    await c.connect(srvAddr)

    const con1 = b[1][1].id
    const con2 = b[2][1].id

    lstep('send1')
    await waitSend(con1, Buffer.from('test1'))

    lstep('send2')
    await waitSend(con2, Buffer.from('test2'))

    lstep('close1')
    await c.close(con1)

    lstep('wait close2')
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

    lstep('destroy')
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

    lstep('done')
  })
})
