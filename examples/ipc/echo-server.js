#!/usr/bin/env node
'use strict'

const n3h = require('../../lib/index')

async function _main () {
  const srv = new n3h.ipc.Server(['ipc://echo-server.sock'])

  process.on('SIGINT', () => {
    srv.close()
    console.log('socket closed')
    process.exit(0)
  })

  srv.on('send', (msg) => {
    console.log('GOT SEND:', {
      toAddress: msg.toAddress.toString('hex'),
      data: msg.data.toString()
    })
    msg.resolve()

    // for an echo, the fromAddress is the toAddress : )
    srv.recvSend(
      msg.toAddress,
      Buffer.from('echo: ' + msg.data.toString()))
  })

  srv.on('call', (msg) => {
    console.log('GOT CALL:', {
      messageId: msg.messageId.toString('hex'),
      toAddress: msg.toAddress.toString('hex'),
      data: msg.data.toString()
    })
    msg.resolve()

    // for an echo, the fromAddress is the toAddress : )
    srv.recvCall(
      msg.messageId,
      msg.toAddress,
      Buffer.from('echo: ' + msg.data.toString()))

    // also simulate a response
    srv.recvCallResp(
      msg.messageId,
      msg.toAddress,
      Buffer.from('resp: ' + msg.data.toString()))
  })

  await srv.ready()
  console.log('up and running')
}

_main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
