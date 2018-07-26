#!/usr/bin/env node
'use strict'

const n3h = require('../../lib/index')

// IPC Echo Server Example
//
// supports multiple "modes" set by sending a specially formatted `send` msg.
//
// send a `send` message with utf8 data: `$$ctrl$$:MODE` where `MODE` is one of:
//
// Modes:
//   - `ECHO` (default) - server will echo all:
//     `send`: RESP_OK, then a RECV_SEND
//     `call`: RESP_OK, then a RECV_CALL
//     `call_resp`: RESP_OK, then a RECV_CALL_RESP
//   - `FAIL` - server will produce:
//     `send`: RESP_FAIL
//     `call`: RESP_FAIL
//     `call_resp`: RESP_FAIL

/**
 * simple example, just one-functioning it... need the async
 */
async function _main () {
  let mode = {}

  const getMode = (clientId) => {
    if (!(clientId in mode)) {
      mode[clientId] = 'ECHO'
    }
    return mode[clientId]
  }

  // set up the listening socket
  const srv = new n3h.ipc.Server(['ipc://echo-server.sock'])

  // handle ctrl-c
  process.on('SIGINT', () => {
    srv.close()
    console.log('socket closed')
    process.exit(0)
  })

  // debug output on connections
  srv.on('clientAdd', (id) => {
    console.log('adding client ' + id)
    mode[id] = 'ECHO'
  })

  // debug output && mem cleanup on connection lost
  srv.on('clientRemove', (id) => {
    console.log('pruning client ' + id)
    delete mode[id]
  })

  // the client sent us a `send`
  srv.on('send', (msg) => {
    const data = msg.data.toString()

    console.log('GOT SEND:', {
      toAddress: msg.toAddress.toString('hex'),
      data: data
    })

    // handle MODE messages
    if (data.startsWith('$$ctrl$$:')) {
      const m = data.substr(9).toUpperCase()
      mode[msg.clientId] = m
      console.log('MODE command, switching to `' + m + '`')
      msg.resolve()
      return
    }

    // handle non-MODE messages
    switch (getMode(msg.clientId)) {
      case 'FAIL':
        console.log('got test send, but in FAIL mode, sending fail')
        msg.reject(new Error('echo server is in FAIL mode'))
        break
      default:
        // default is ECHO mode

        console.log('got test send, attempting to resolve')
        msg.resolve()

        // for an echo, the fromAddress is the toAddress : )
        srv.recvSend(
          msg.toAddress,
          Buffer.from('echo: ' + data))
        break
    }
  })

  // the client sent us a `call`
  srv.on('call', (msg) => {
    const data = msg.data.toString()

    console.log('GOT CALL:', {
      messageId: msg.messageId.toString('hex'),
      toAddress: msg.toAddress.toString('hex'),
      data: data
    })

    switch (getMode(msg.clientId)) {
      case 'FAIL':
        console.log('got test call, but in FAIL mode, sending fail')
        msg.reject(new Error('echo server is in FAIL mode'))
        break
      default:
        // default is ECHO mode

        console.log('got test call, attempting to resolve')
        msg.resolve()

        // for an echo, the fromAddress is the toAddress : )
        srv.recvCall(
          msg.messageId,
          msg.toAddress,
          Buffer.from('echo: ' + data))
        break
    }
  })

  // the client sent us a `callResp`
  srv.on('callResp', (msg) => {
    const data = msg.data.toString()

    console.log('GOT CALL_RESP:', {
      messageId: msg.messageId.toString('hex'),
      toAddress: msg.toAddress.toString('hex'),
      data: data
    })

    switch (getMode(msg.clientId)) {
      case 'FAIL':
        console.log('got test call_resp, but in FAIL mode, sending fail')
        msg.reject(new Error('echo server is in FAIL mode'))
        break
      default:
        // default is ECHO mode

        console.log('got test call_resp, attempting to resolve')
        msg.resolve()

        // also simulate a response
        srv.recvCallResp(
          msg.messageId,
          msg.toAddress,
          Buffer.from('echo: ' + data))
        break
    }
  })

  // make sure we are listening
  await srv.ready()

  console.log('up and running')
}

_main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
