const { createServer } = require('./https-server')
const { request } = require('./https-client')
const Ws = require('ws')

const https = require('https')
const agent = new https.Agent({
  rejectUnauthorized: false
})

const PORT = 8443

describe('integration Suite', () => {
  it('should serve stuff', async () => {
    const srv = await createServer('hello', {
      rsaBits: 1024,
      port: PORT
    })

    await new Promise((resolve, reject) => {
      const con = new Ws('wss://localhost:8443/', {
        perMessageDeflate: false,
        agent
      })
      con.on('error', e => {
        console.error(e)
      })
      con.on('close', (code, reason) => {
        console.error('closed', code, reason)
      })
      con.on('open', () => {
        con.send('yo!!')
      })
      con.on('message', (data) => {
        console.log('websocket got:', data)
        resolve()
        con.close(1000, 'normal')
        resolve()
      })
    })

    const res = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'POST'
    }, Buffer.from('hello'))

    console.log(res.body.toString())

    await srv.close()
  })
})
