#!/usr/bin/env node
'use strict'

const n3h = require('../../lib/index')

// IPC Echo Client Example
//
// connects to echo-server.js socket, and runs through some tests

/**
 * assert that `expr` is true or throw `msg`
 */
function assert (expr, msg) {
  if (!expr) throw new Error(msg)
}

/**
 * assert that async function `fn` throws an error
 */
async function assertFail (fn) {
  for (let promise of fn()) {
    let failOk = false
    try {
      await promise
    } catch (e) {
      failOk = true
    }
    if (!failOk) {
      throw new Error('expected error, but got success')
    }
  }
}

/**
 * add a timeout reject to a sub-promise
 */
function chainTimer (ms, promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('timeout'))
    }, ms)
    promise.then((...args) => {
      clearTimeout(timer)
      resolve(...args)
    }, (...args) => {
      clearTimeout(timer)
      reject(new Error(JSON.stringify(args)))
    })
  })
}

/**
 * main async function - run through the exercises
 */
async function _main () {
  const recvSendQueue = []
  const recvCallQueue = []
  const recvCallRespQueue = []
  let result

  const getRecv = (queue) => {
    return new Promise((resolve, reject) => {
      if (queue.length > 0) {
        resolve(queue.shift())
        return
      }
      const timer = setTimeout(() => {
        clearInterval(inter)
        reject(new Error('timeout'))
      }, 500)
      const inter = setInterval(() => {
        if (queue.length > 0) {
          clearInterval(inter)
          clearTimeout(timer)
          resolve(queue.shift())
        }
      }, 10)
    })
  }

  // connect to the ipc listening socket (echo-server.js)
  const cli = new n3h.ipc.Client('ipc://echo-server.sock')

  // listen to some server-sent events
  cli.on('recvSend', (msg) => {
    recvSendQueue.push(msg)
  })
  cli.on('recvCall', (msg) => {
    recvCallQueue.push(msg)
  })
  cli.on('recvCallResp', (msg) => {
    recvCallRespQueue.push(msg)
  })

  // wait for us to actually connect
  await cli.ready()
  console.log('connected')

  // -- test some things with the server in FAIL mode -- //

  console.log('# (... switching to `FAIL` mode ...)')
  await cli.send(Buffer.alloc(0), Buffer.from('$$ctrl$$:FAIL'))

  console.log('# TESTING in `FAIL` mode')

  // test that a `send` fails
  console.log('- send')
  await assertFail(() => {
    return [cli.send(Buffer.alloc(0), Buffer.from('test'))]
  })
  assert(recvSendQueue.length === 0, 'errant send received')

  // test that both promises in a `call` fail
  console.log('- call')
  await assertFail(() => {
    let { callPromise, responsePromise } =
      cli.call(Buffer.alloc(0), Buffer.from('test'))
    return [callPromise, responsePromise]
  })
  assert(recvCallQueue.length === 0, 'errant call received')
  assert(recvCallRespQueue.length === 0, 'errant call_resp received')

  // test that a `callResp` fails
  console.log('- call_resp')
  await assertFail(() => {
    return [cli.callResp(Buffer.alloc(0), Buffer.alloc(0), Buffer.from('test'))]
  })
  assert(recvCallRespQueue.length === 0, 'errant call_resp received')

  // -- test some things with the server in ECHO mode -- //

  console.log('# (... switching to `ECHO` mode ...)')
  await cli.send(Buffer.alloc(0), Buffer.from('$$ctrl$$:ECHO'))

  console.log('# TESTING in `ECHO` mode')

  // make sure a `send` succeeds
  console.log('- send')
  await cli.send(Buffer.alloc(0), Buffer.from('test'))

  // make sure we get the echoed `send`
  result = (await getRecv(recvSendQueue)).data.toString()
  assert(result === 'echo: test', 'bad send: (' + result + ')')

  // make sure a `call` succeeds
  // track the responsePromise for later after we send the callResp
  console.log('- call')
  let { callPromise, responsePromise } =
    cli.call(Buffer.alloc(0), Buffer.from('test'))
  await callPromise

  // make sure we get the echoed `call`
  result = await getRecv(recvCallQueue)
  assert(result.data.toString() === 'echo: test', 'bad send: (' + result.data + ')')

  // make sure a `callResp` succeeds
  console.log('- call_resp')
  await cli.callResp(result.messageId, result.fromAddress, Buffer.from('test'))

  // make sure we get the echoed `callResp`
  result = (await getRecv(recvCallRespQueue)).data.toString()
  assert(result === 'echo: test', 'bad send: (' + result + ')')

  // make sure the echoed `callResp` resolved our previous `call` responsePromise
  await chainTimer(500, responsePromise)

  // clean up the socket so we can exit
  cli.close()

  console.log('# SUCCESS - echo-client completed all tasks')
}

_main().then(() => {}, (err) => {
  console.error('echo-client DIED')
  console.error(err)
  process.exit(1)
})
