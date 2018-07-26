/*!
IPC Server represents an ipc listening socket designed to expose the functionality of a running p2p connection process.

Clients should connect to this._socket to send / receive messages from the p2p network.
*/

const EventEmitter = require('events')

const zmq = require('zeromq')
const msgpack = require('msgpack-lite')

const common = require('./msg-types')

/**
 * IPC control api server
 * @example
 * const IpcServer = require('n3h').ipc.Server
 * const srv = new IpcServer(['ipc://my-socket.ipc', 'tcp://*:12345'])
 */
class Server extends EventEmitter {
  /**
   * Binds to the list of ZeroMq endpoints specified in `bind` argument
   *
   * @param {array<string>} bind - the array of endpoint to bind
   */
  constructor (bind) {
    super()

    this._socket = null
    this._clients = {}

    this._pruneClientsTimer = setInterval(() => {
      this._pruneClients()
    }, 1500)

    this._startPromise = new Promise((resolve, reject) => {
      const toBind = {}

      const bindTimeout = setTimeout(() => {
        reject(new Error('timeout binding to: ' + Object.keys(toBind)))
      }, 1000)

      this._socket = zmq.socket('router')
      this._socket.setsockopt(zmq.options.identity, common.SRV_ID)
      this._socket.on('message', (...args) => {
        this._handleMessage(...args)
      })
      this._socket.on('error', (...args) => {
        console.error(args)
        process.exit(1)
      })

      this._socket.on('bind', (binding) => {
        delete toBind[binding]
        if (Object.keys(toBind).length < 1) {
          clearTimeout(bindTimeout)
          resolve()
        }
      })
      for (let b of bind) {
        toBind[b] = true
        this._socket.bind(b)
      }
    })
  }

  /**
   * @return {Promise} - when we have successfully bound to bind sockets
   */
  ready () {
    return this._startPromise
  }

  /**
   * Close all listening sockets, and remove all event listeners.
   * Do not use this server again, create a new one.
   */
  close () {
    this.removeAllListeners()
    this.setMaxListeners(0)
    this._socket.close()
    this._socket = null
    clearInterval(this._pruneClientsTimer)
  }

  /**
   * We have received a "send" on the p2p network, transmit it to any
   * listening ipc sockets.
   *
   * @param {Buffer} fromAddress - the origin address of the message
   * @param {Buffer} data - the message content
   */
  recvSend (fromAddress, data) {
    if (!(fromAddress instanceof Buffer) || !(data instanceof Buffer)) {
      throw new Error('expected two buffers')
    }
    setImmediate(() => {
      this._broadcast(common.MSG_SRV.RECV_SEND, [
        fromAddress, data
      ])
    })
  }

  /**
   * We have received a "call" on the p2p network, transmit it to any
   * listening ipc sockets.
   *
   * @param {Buffer} messageId - identifier to correlate the callResp
   * @param {Buffer} fromAddress - the origin address of the message
   * @param {Buffer} data - the message content
   */
  recvCall (messageId, fromAddress, data) {
    if (!(messageId instanceof Buffer) || !(fromAddress instanceof Buffer) || !(data instanceof Buffer)) {
      throw new Error('expected three buffers')
    }
    setImmediate(() => {
      this._broadcast(common.MSG_SRV.RECV_CALL, [
        messageId, fromAddress, data
      ])
    })
  }

  /**
   * We have received a "callResp" on the p2p network, transmit it to any
   * listening ipc sockets.
   *
   * @param {Buffer} messageId - identifier to correlate to our origin call
   * @param {Buffer} fromAddress - the origin address of the message
   * @param {Buffer} data - the message content
   */
  recvCallResp (messageId, fromAddress, data) {
    if (!(messageId instanceof Buffer) || !(fromAddress instanceof Buffer) || !(data instanceof Buffer)) {
      throw new Error('expected three buffers')
    }
    setImmediate(() => {
      this._broadcast(common.MSG_SRV.RECV_CALL_RESP, [
        messageId, fromAddress, data
      ])
    })
  }

  // -- private -- //

  /**
   * run periodically to free up memory from disconnected sockets
   * @private
   */
  _pruneClients () {
    const now = Date.now()
    const b4list = Object.keys(this._clients)
    for (let id in this._clients) {
      const client = this._clients[id]
      if (now - client.last > 3000) {
        this.emit('clientRemove', id)
        delete this._clients[id]
      }
    }
    const a4list = Object.keys(this._clients)
    if (b4list.length !== a4list.length) {
    }
  }

  /**
   * when we get a new client connection, start tracking some data
   * @private
   */
  _tickle (id) {
    if (id in this._clients) {
      this._clients[id].last = Date.now()
    } else {
      this._clients[id] = {
        last: Date.now()
      }
      this.emit('clientAdd', id)
    }
  }

  /**
   * we have received a message from a client socket, identify / distribute
   * @private
   */
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
          case common.MSG_CLI.PING:
            this._handlePing(id, msgpack.decode(args[2].slice(1)))
            break
          case common.MSG_CLI.SEND:
            this._handleSend(id, msgpack.decode(args[2].slice(1)))
            break
          case common.MSG_CLI.CALL:
            this._handleCall(id, msgpack.decode(args[2].slice(1)))
            break
          case common.MSG_CLI.CALL_RESP:
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

  /**
   * we received a ping, send a pong
   * @private
   */
  _handlePing (id, start) {
    this._send(id, common.MSG_SRV.PONG, [
      start, Date.now()
    ])
  }

  /**
   * we received a send, forward it to our implementor
   * @private
   */
  async _handleSend (id, msg) {
    this._trackEmit(id, msg[0], async (resolve, reject) => {
      this.emit('send', {
        clientId: id,
        toAddress: Buffer.from(msg[1]),
        data: Buffer.from(msg[2]),
        resolve,
        reject
      })
    })
  }

  /**
   * we received a call, forward it to our implementor
   * @private
   */
  async _handleCall (id, msg) {
    this._trackEmit(id, msg[0], async (resolve, reject) => {
      this.emit('call', {
        clientId: id,
        messageId: Buffer.from(msg[1]),
        toAddress: Buffer.from(msg[2]),
        data: Buffer.from(msg[3]),
        resolve,
        reject
      })
    })
  }

  /**
   * we received a call_resp, forward it to our implementor
   * @private
   */
  async _handleCallResp (id, msg) {
    this._trackEmit(id, msg[0], async (resolve, reject) => {
      this.emit('callResp', {
        clientId: id,
        messageId: Buffer.from(msg[1]),
        toAddress: Buffer.from(msg[2]),
        data: Buffer.from(msg[3]),
        resolve,
        reject
      })
    })
  }

  /**
   * helper to make sure our implementor handles a message
   * to clean up the memory involved in our message tracking
   * @private
   */
  async _trackEmit (id, locId, fn) {
    let timeout
    try {
      const timeoutStack = (new Error('timeout')).stack
      timeout = setTimeout(() => {
        throw new Error('timeout, inner-stack: ' + timeoutStack)
      }, 1000)
      await new Promise(async (resolve, reject) => {
        await fn(resolve, reject)
      })
      clearTimeout(timeout)
      this._send(id, common.MSG_SRV.RESP_OK, [
        locId
      ])
    } catch (e) {
      try {
        clearTimeout(timeout)
        this._send(id, common.MSG_SRV.RESP_FAIL, [
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

  /**
   * Actually send data out on the socket
   * @private
   */
  _send (id, type, data) {
    this._socket.send([
      Buffer.from(id, 'hex'),
      Buffer.alloc(0),
      Buffer.concat([
        Buffer.from([type]),
        msgpack.encode(data)
      ])
    ])
  }

  /**
   * Broadcast data to all connected clients
   * @private
   */
  _broadcast (type, data) {
    data = Buffer.concat([
      Buffer.from([type]),
      msgpack.encode(data)
    ])
    for (let id in this._clients) {
      this._socket.send([
        Buffer.from(id, 'hex'),
        Buffer.alloc(0),
        data
      ])
    }
  }
}

// export
exports.Server = Server
