const { expect } = require('chai')
const { Connection } = require('@holochain/n3h-mod-spec')
const { ConnectionBackendWss } = require('./index')
const { $sleep } = require('@holochain/n3h-common')

describe('Wss Connection Suite', () => {
  let c = null
  let b = []

  beforeEach(async function () {
    this.timeout(5000)
    b = []

    c = await new Connection(ConnectionBackendWss, {
      passphrase: 'hello',
      rsaBits: 1024
    })

    c.on('event', e => b.push(e))

    console.log('binding, may generate cert')
    await c.bind('wss://0.0.0.0:0/hello-test')
    console.log('binding complete')
  })

  afterEach(async () => {
    await c.destroy()
    c = null
    b = null
  })

  it('full api', async () => {
    const now = Date.now()
    const lstep = (...args) => {
      const ts = Date.now() - now
      console.log('[' + ts + ' ms]', ...args)
    }

    const waitSend = async (idList, buf) => {
      let bidx = b.length
      await c.send(idList, buf)
      for (;;) {
        await $sleep(10)
        for (let i = bidx; i < b.length; ++i) {
          if (b[i].type === 'message') {
            return
          }
        }
      }
    }

    const srvAddr = b[0].boundUriList[0]

    lstep('connect')
    await c.connect(srvAddr)

    const con1 = b[1].id
    const con2 = b[2].id

    lstep('send1')
    await waitSend([con1], Buffer.from('test1').toString('base64'))

    lstep('send2')
    await waitSend([con2], Buffer.from('test2').toString('base64'))

    lstep('close1')
    await c.close(con1)

    lstep('wait close2')
    await (async () => {
      for (;;) {
        await $sleep(10)
        for (let i of b) {
          if (i.type === 'close' && i.data.spec === srvAddr) {
            return
          }
        }
      }
    })()

    lstep('destroy')
    await c.destroy()

    expect(b.map(b => b.type)).deep.equals([
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
