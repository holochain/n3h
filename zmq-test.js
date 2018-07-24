#!/usr/bin/env node
'use strict'

const crypto = require('crypto')

const n3h = require('./lib/index')

async function _main () {
  const srv = new n3h.ipc.Server(['ipc://hello.sock'])
  srv.on('send', (msg) => {
    console.log('GOT SEND:',
      msg.toAddress.toString('hex'),
      msg.data.toString())
    msg.resolve()

    // this doesn't make any sense, but helps with testing
    srv.recvSend(msg.toAddress, msg.data)
  })
  srv.on('call', (msg) => {
    console.log('GOT CALL:',
      msg.messageId.toString('hex'),
      msg.toAddress.toString('hex'),
      msg.data.toString())
    msg.resolve()

    // this doesn't make any sense, but helps with testing
    srv.recvCall(msg.messageId, msg.toAddress, msg.data)

    // this makes a little more sense, but needs better data
    srv.recvCallResp(msg.messageId, msg.toAddress, msg.data)
  })

  const cli1 = new n3h.ipc.Client('ipc://hello.sock')
  cli1.on('recvSend', (msg) => {
    console.log('GOT RECV_SEND:',
      msg.fromAddress.toString('hex'),
      msg.data.toString())
  })
  cli1.on('recvCall', (msg) => {
    console.log('GOT RECV_CALL:',
      msg.messageId.toString('hex'),
      msg.fromAddress.toString('hex'),
      msg.data.toString())
  })
  cli1.on('recvCallResp', (msg) => {
    console.log('GOT RECV_CALL_RESP:',
      msg.messageId.toString('hex'),
      msg.fromAddress.toString('hex'),
      msg.data.toString())

    // shutdown
    cli1.close()
    cli2.close()
    srv.close()
  })

  const cli2 = new n3h.ipc.Client('ipc://hello.sock')
  await Promise.all([
    cli1.ready(),
    cli2.ready()
  ])

  console.log('BOTH READY : )')

  console.log('sending...')
  await cli1.send(Buffer.from('ab12', 'hex'), Buffer.from('hello'))
  console.log('send success : )')

  console.log('calling...')
  await cli1.call(
    crypto.randomBytes(2),
    Buffer.from('ab12', 'hex'),
    Buffer.from('hello')
  )
  console.log('call success : )')
}

_main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
