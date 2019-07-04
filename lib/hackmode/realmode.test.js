const { expect } = require('chai')
const https = require('https')
const WebSocket = require('ws')

const lib = require('./realmode')

const agent = new https.Agent({
  rejectUnauthorized: false
})

describe('RealMode Suite', () => {
  it('should be a function', () => {
    expect(typeof lib.N3hRealMode).equals('function')
  })

  it('should die on last ipc disconnect', async () => {
    let termRes = null
    let termRej = null
    let promiseOut = new Promise((resolve, reject) => {
      termRes = resolve
      termRej = reject
    })

    let n3hNode = null
    n3hNode = await new lib.N3hRealMode('.', {}, async () => {
      await n3hNode.destroy()
      termRes()
    })

    const uri = n3hNode._ipcBoundUri

    const con1 = await new Promise((resolve, reject) => {
      const con1 = new WebSocket(uri, {
        perMessageDeflate: false,
        agent
      })
      con1.on('error', termRej)
      con1.on('open', () => resolve(con1))
    })

    con1.close()

    return promiseOut
  }).timeout(10000)
})
