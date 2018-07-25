#!/usr/bin/env node
'use strict'

const n3h = require('../../lib/index')

function assert (expr, msg) {
  if (!expr) throw new Error(msg)
}

async function assert_fail (fn) {
  for (let promise of fn()) {
    let fail_ok = false
    try {
      await promise
    } catch (e) {
      fail_ok = true
    }
    if (!fail_ok) {
      throw new Error('expected error, but got success')
    }
  }
}

async function _main () {
  const cli = new n3h.ipc.Client('ipc://echo-server.sock')

  console.log('# (... switching to `FAIL` mode ...)')
  await cli.send(Buffer.alloc(0), Buffer.from('$$ctrl$$:FAIL'))

  console.log('# TESTING in `FAIL` mode')

  console.log('- send')
  await assert_fail(() => {
    return [cli.send(Buffer.alloc(0), Buffer.from('test'))]
  })

  console.log('- call')
  await assert_fail(() => {
    let { callPromise, responsePromise } =
      cli.call(Buffer.alloc(0), Buffer.from('test'))
    return [callPromise, responsePromise]
  })

  console.log('# (... switching to `ECHO` mode ...)')
  await cli.send(Buffer.alloc(0), Buffer.from('$$ctrl$$:ECHO'))

  console.log('# TESTING in `ECHO` mode')

  console.log('- send')
  await cli.send(Buffer.alloc(0), Buffer.from('test'))

  console.log('- call')
  let { callPromise, responsePromise } =
    cli.call(Buffer.alloc(0), Buffer.from('test'))
  await callPromise

  // this has to timeout to fail... do this better... maybe send the resp??
  await assert_fail(() => [responsePromise])

  /*
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
  */

  cli.close()
}

_main().then(() => {}, (err) => {
  console.error('echo-client DIED')
  console.error(err)
  process.exit(1)
})
