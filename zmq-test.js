#!/usr/bin/env node
'use strict'

const crypto = require('crypto')
const EventEmitter = require('events')

const zmq = require('zeromq')
const msgpack = require('msgpack-lite')

const SRV_ID = Buffer.from([0x24, 0x24, 0x24, 0x24])

// these message types are sent out by clients to the p2p IPC socket
const MSG_CLI = {
  _RES_AUTH_1: 0x00, // reserved for authentication
  _RES_AUTH_2: 0x01, // reserved for authentication

  /* client initiated heartbeat
   *
   * [0x02, msgpack(
   *   (int) // start-time millis epoch timestamp
   * )]
   */
  PING: 0x02,

  /* publish a fire/forget message to the specified node
   *
   * [0x03, msgpack(
   *   array[
   *     (binary), // local-only message identifier
   *     (binary), // to address
   *     (binary), // message data
   *   ]
   * )]
   */
  SEND: 0x03,

  /* send a message to a node, and await a response
   *
   * [0x04, msgpack(
   *   array[
   *     (binary), // local-only message identifier
   *     (binary), // remote message identifier
   *     (binary), // to address
   *     (binary), // message data
   *   ]
   * )]
   */
  CALL: 0x04,

  /* send a call response back to the node that made the original request
   *
   * [0x05, msgpack(
   *   array[
   *     (binary), // local-only message identifier
   *     (binary), // remote message identifier
   *     (binary), // massage data
   *   ]
   * )]
   */
  CALL_RESP: 0x05
}

// clients receive these message types from the p2p IPC socket
const MSG_SRV = {
  _RES_AUTH_1: 0x00, // reserved for authentication
  _RES_AUTH_2: 0x01, // reserved for authentication

  /* response to client initiated heartbeat
   *
   * [0x02, msgpack(
   *   array[
   *     (int), // start-time millis epoch timestamp
   *     (int), // server response time millis epoch timestamp
   *   ]
   * )]
   */
  PONG: 0x02,

  /* server was able to process the request
   *
   * [0x03, msgpack(
   *   (binary), // local-only message identifier
   * )]
   */
  RESP_OK: 0x03,

  /* server was un-able to process the request
   *
   * [0x04, msgpack(
   *   array[
   *     (binary), // local-only message identifier
   *     (int),    // error code
   *     (string), // error message
   *   ]
   * )]
   */
  RESP_FAIL: 0x04,

  /* we received a direct message from another node
   *
   * [0x05, msgpack(
   *   array[
   *     (binary), // from address
   *     (binary), // message data
   *   ]
   * )]
   */
  RECV_SEND: 0x05,

  /* we received a "call" request from another node
   *
   * [0x06, msgpack(
   *   array[
   *     (binary), // remote message identifier
   *     (binary), // from address
   *     (binary), // message data
   *   ]
   * )]
   */
  RECV_CALL: 0x06,

  /* we received a "call" response from another node to a call we made
   *
   * [0x07, msgpack(
   *   array[
   *     (binary), // remote message identifier
   *     (binary), // from address
   *     (binary), // message data
   *   ]
   * )]
   */
  RECV_CALL_RESP: 0x07
}

class Server extends EventEmitter {
  constructor (bind) {
    super()

    this.socket = zmq.socket('router')
    this.socket.setsockopt(zmq.options.identity, SRV_ID)
    this.socket.on('message', (...args) => {
      this._handleMessage(...args)
    })

    for (let b of bind) {
      this.socket.bind(b)
    }

    this.clients = {}

    this.pruneClientsTimer = setInterval(() => {
      this._pruneClients()
    }, 500)
  }

  close () {
    this.removeAllListeners()
    this.setMaxListeners(0)
    this.socket.close()
    this.socket = null
    clearInterval(this.pruneClientsTimer)
  }

  recvSend (fromAddress, data) {
    this._broadcast(MSG_SRV.RECV_SEND, [
      fromAddress, data
    ])
  }

  recvCall (messageId, fromAddress, data) {
    this._broadcast(MSG_SRV.RECV_CALL, [
      messageId, fromAddress, data
    ])
  }

  recvCallResp (messageId, fromAddress, data) {
    this._broadcast(MSG_SRV.RECV_CALL_RESP, [
      messageId, fromAddress, data
    ])
  }

  // -- private -- //

  _pruneClients () {
    const now = Date.now()
    for (let id in this.clients) {
      const client = this.clients[id]
      if (now - client.last > 1000) {
        delete this.clients[id]
      }
    }
  }

  _tickle (id) {
    if (id in this.clients) {
      this.clients[id].last = Date.now()
    } else {
      this.clients[id] = {
        last: Date.now()
      }
    }
  }

  _handleMessage (...args) {
    try {
      if (args.length !== 3) {
        throw new Error('wrong msg size: ' + args.length)
      }
      const id = args[0].toString('hex')
      this._tickle(id)
      try {
        const type = args[2].readUInt8(0)
        switch (type) {
          case MSG_CLI.PING:
            this._handlePing(id, msgpack.decode(args[2].slice(1)))
            break
          case MSG_CLI.SEND:
            this._handleSend(id, msgpack.decode(args[2].slice(1)))
            break
          case MSG_CLI.CALL:
            this._handleCall(id, msgpack.decode(args[2].slice(1)))
            break
          case MSG_CLI.CALL_RESP:
            this._handleCallResp(id, msgpack.decode(args[2].slice(1)))
            break
          default:
            throw new Error('unhandled message type: ' + type)
        }
      } catch (e) {
        console.error(e)
        this._respFail(id, e)
      }
    } catch (e) {
      console.error(e)
      process.exit(1)
    }
  }

  _handlePing (id, start) {
    console.log('got ping', id, start)
    this._send(id, MSG_SRV.PONG, [
      start, Date.now()
    ])
  }

  async _handleSend (id, msg) {
    this._trackEmit(id, msg[0], async (resolve, reject) => {
      this.emit('send', {
        toAddress: msg[1],
        data: msg[2],
        resolve,
        reject
      })
    })
  }

  async _handleCall (id, msg) {
    this._trackEmit(id, msg[0], async (resolve, reject) => {
      this.emit('call', {
        messageId: msg[1],
        toAddress: msg[2],
        data: msg[3],
        resolve,
        reject
      })
    })
  }

  async _trackEmit (id, locId, fn) {
    try {
      const timeout = setTimeout(() => {
        throw new Error('timeout')
      }, 1000)
      await new Promise(async (resolve, reject) => {
        await fn(resolve, reject)
      })
      clearTimeout(timeout)
      this._send(id, MSG_SRV.RESP_OK, [
        locId
      ])
    } catch (e) {
      try {
        this._send(id, MSG_SRV.RESP_FAIL, [
          locId,
          0, // undefined error, look at message text
          e.stack || e.toString()
        ])
      } catch (e2) {
        console.error(e)
        console.error(e2)
        process.exit(1)
      }
    }
  }

  _respOk (id, data) {
    this._send(id, MSG_SRV.RESP_OK, data)
  }

  _respFail (id, err) {
    try {
      this._send(id, MSG_SRV.RESP_FAIL, [
        0, // undefined error, check error messag in idx 1
        err.stack || err.toString()
      ])
    } catch (e) {
      console.error(e)
      process.exit(1)
    }
  }

  _send (id, type, data) {
    this.socket.send([
      Buffer.from(id, 'hex'),
      Buffer.alloc(0),
      Buffer.concat([
        Buffer.from([type]),
        msgpack.encode(data)
      ])
    ])
  }

  _broadcast (type, data) {
    data = Buffer.concat([
      Buffer.from([type]),
      msgpack.encode(data)
    ])
    for (let id in this.clients) {
      this.socket.send([
        Buffer.from(id, 'hex'),
        Buffer.alloc(0),
        data
      ])
    }
  }
}

class Client extends EventEmitter {
  constructor (endpoint) {
    super()

    this.nextWaitingId = 0
    this.waiting = {}
    this.socket = zmq.socket('router')
    this.socket.on('message', (...args) => {
      this._handleMessage(...args)
    })
    this.socket.connect(endpoint)

    this.startResolve = null
    this.startPromise = new Promise((resolve, reject) => {
      this.startResolve = resolve
    })
    this.startPoll = setInterval(() => {
      this.ping()
    }, 100)
    this.ping()

    this.heartbeatTimer = setInterval(() => {
      this.ping()
    }, 500)
  }

  ready () {
    return this.startPromise
  }

  close () {
    this.socket.close()
    this.socket = null
    this.waiting = null
    clearInterval(this.heartbeatTimer)
  }

  ping () {
    this._send(MSG_CLI.PING, Date.now())
  }

  send (toAddress, data) {
    return this._trackMessage(async (id) => {
      this._send(MSG_CLI.SEND, [
        id, toAddress, data
      ])
    })
  }

  call (msgId, toAddress, data) {
    return this._trackMessage(async (id) => {
      this._send(MSG_CLI.CALL, [
        id,
        msgId,
        toAddress,
        data
      ])
    })
  }

  // -- private -- //

  _nextId () {
    let id = this.nextWaitingId++
    id = id.toString(16)
    if (id.length % 2 === 1) {
      id = '0' + id
    }
    return Buffer.from(id, 'hex')
  }

  _trackMessage (fn) {
    return new Promise(async (resolve, reject) => {
      try {
        const id = this._nextId()
        this.waiting[id] = {
          resolve,
          reject
        }
        await fn(id)
      } catch (e) {
        reject(e)
      }
    })
  }

  _handleMessage (...args) {
    if (args.length !== 3) {
      throw new Error('wrong msg size: ' + args.length)
    }
    const type = args[2].readUInt8(0)
    switch (type) {
      case MSG_SRV.PONG:
        this._handlePong(msgpack.decode(args[2].slice(1)))
        break
      case MSG_SRV.RESP_OK:
        this._handleResp(msgpack.decode(args[2].slice(1)))
        break
      case MSG_SRV.RESP_FAIL:
        this._handleRespFail(msgpack.decode(args[2].slice(1)))
        break
      case MSG_SRV.RECV_SEND:
        this._handleRecvSend(msgpack.decode(args[2].slice(1)))
        break
      case MSG_SRV.RECV_CALL:
        this._handleRecvCall(msgpack.decode(args[2].slice(1)))
        break
      case MSG_SRV.RECV_CALL_RESP:
        this._handleRecvCallResp(msgpack.decode(args[2].slice(1)))
        break
      default:
        throw new Error('unhandled message type: ' + type)
    }
  }

  _handlePong (msg) {
    console.log('got pong', {
      toServerMs: msg[1] - msg[0],
      roundTripMs: Date.now() - msg[0]
    })
    clearInterval(this.startPoll)
    this.startResolve()
  }

  _handleResp (msg) {
    if (!(msg[0] in this.waiting)) {
      throw new Error('errant message id from server')
    }
    this.waiting[msg[0]].resolve()
    delete this.waiting[msg[0]]
  }

  _handleRespFail (msg) {
    if (!(msg[0] in this.waiting)) {
      throw new Error('errant fail message from server: ' + JSON.stringify(msg))
    }
    this.waiting[msg[0]].reject(msg[1])
    delete this.waiting[msg[0]]
  }

  _handleRecvSend (msg) {
    this.emit('recvSend', {
      fromAddress: msg[0],
      data: msg[1]
    })
  }

  _handleRecvCall (msg) {
    this.emit('recvCall', {
      messageId: msg[0],
      fromAddress: msg[1],
      data: msg[2]
    })
  }

  _handleRecvCallResp (msg) {
    this.emit('recvCallResp', {
      messageId: msg[0],
      fromAddress: msg[1],
      data: msg[2]
    })
  }

  _send (type, data) {
    if (data) {
      data = Buffer.concat([
        Buffer.from([type]),
        msgpack.encode(data)
      ])
    } else {
      data = Buffer.from([type])
    }
    this.socket.send([
      SRV_ID,
      Buffer.alloc(0),
      data
    ])
  }
}

async function _main () {
  const srv = new Server(['ipc://hello.sock'])
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

  const cli1 = new Client('ipc://hello.sock')
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

  const cli2 = new Client('ipc://hello.sock')
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
