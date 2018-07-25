#!/usr/bin/env node
'use strict'

const n3h = require('../../lib/index')

async function _main () {
  const cli = new n3h.ipc.Client('ipc://echo-server.sock')
  cli.on('recvSend', (msg) => {
    console.log('GOT RECV_SEND:',
      msg.fromAddress.toString('hex'),
      msg.data.toString())
  })
  cli.on('recvCall', (msg) => {
    console.log('GOT RECV_CALL:',
      msg.messageId.toString('hex'),
      msg.fromAddress.toString('hex'),
      msg.data.toString())
  })

  await cli.ready()

  console.log('sending...')
  await cli.send(Buffer.from('ab12', 'hex'), Buffer.from('hello'))
  console.log('send success : )')

  console.log('calling...')
  const resp = await cli.call(
    Buffer.from('ab12', 'hex'),
    Buffer.from('hello')
  )
  console.log('call success:',
    resp.fromAddress.toString('hex'),
    resp.data.toString())

  cli.close()
}

_main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
