const { Connection } = require('./spec')
const { ConnectionBackendWss } = require('./wss-connection')
const { $sleep } = require('@holochain/n3h-common')

describe('Wss Connection Suite', () => {
  it('full api', async () => {
    const c = await new Connection(ConnectionBackendWss, {
      rsaBits: 1024
    })

    const b = []

    c.on('error', e => b.push(['error', e]))
    c.on('bind', s => b.push(['bind', s]))
    c.on('connect', c => b.push(['connect', c]))
    c.on('connection', c => b.push(['connection', c]))
    c.on('message', (c, buf) => b.push(['message', c, buf]))
    c.on('close', c => b.push(['close', c]))

    await c.bind('wss://0.0.0.0:8443')

    const srvAddr = b[0][1]

    await c.connect(srvAddr)

    const con1 = b[1][1].id
    const con2 = b[2][1].id

    await c.send(con1, Buffer.from('test1'))
    await c.send(con2, Buffer.from('test2'))

    await $sleep(200)

    await c.close(con1)

    await $sleep(200)

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

    console.log(JSON.stringify(b, null, 2))
  })
})
