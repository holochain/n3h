/*!
IPC Server represents an ipc listening socket designed to expose the functionality of a running p2p connection process.

Clients should connect to this._socket to send / receive messages from the p2p network.
*/

const zmq = require('zeromq')
const msgpack = require('msgpack-lite')

const msg = require('./msg-types')
const common = require('./common')

/**
 * IPC control api server
 * @example
 * const srv = new IpcServer()
 * await srv.bind(['ipc://my-socket.ipc', 'tcp://*:12345'])
 */
class IpcServer extends common.EventClass {
  /**
   * create a new ipc server instance
   */
  constructor () {
    super(() => {
      this._clients = null
      this._awaitBind = null
      this._socket.close()
      this._socket = null
      clearInterval(this._pruneClientsTimer)
    })

    this._destroyed = false
    this._awaitBind = new Map()
    this._clients = new Map()

    this._socket = zmq.socket('router')
    this._socket.setsockopt(zmq.options.identity, msg.SRV_ID)
    this._socket.on('message', (...args) => {
      this._handleMessage(...args)
    })
    this._socket.on('error', (...args) => {
      console.error(args)
      process.exit(1)
    })
    this._socket.on('bind', b => {
      this._handleBind(b)
    })

    this._pruneClientsTimer = setInterval(() => {
      this._pruneClients()
    }, 1500)
  }

  /**
   * Bind / create a listening socket for clients to connect to
   * @param {array|string} bindArray - list of zmq endpoints to bind
   * @return {Promise} resolved if all connections bind successfully
   */
  bind (bindArray) {
    this.$checkDestroyed()
    if (!Array.isArray(bindArray)) {
      if (bindArray) {
        bindArray = [bindArray]
      } else {
        bindArray = []
      }
    }
    return Promise.all(bindArray.map(b => {
      return this._bind(b)
    }))
  }

  /**
   * Transmit a `call` message to all ipc clients
   * @param {Buffer} data - the message content
   * @return {array} array of response data from all clients
   */
  call (data) {
    this.$checkDestroyed()
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer')
    }

    const all = []

    for (let zmqid of this._clients.keys()) {
      const messageId = this.$nextId()
      const promise = this.$trackMessage(messageId, 1000)

      const sendData = Buffer.concat([
        Buffer.from([msg.Message.CALL]),
        msgpack.encode([
          messageId,
          data
        ])
      ])

      this._socket.send([
        Buffer.from(zmqid, 'hex'),
        Buffer.alloc(0),
        sendData
      ])

      // make sure we get all the results, even the errors
      all.push(new Promise((resolve, reject) => {
        promise.then((result) => {
          resolve({ result })
        }, (err) => {
          resolve({ error: err })
        })
      }))
    }

    return Promise.all(all)
  }

  // -- private -- //

  /**
   * private helper for binding a single string zmq listening socket
   * @private
   */
  _bind (bind) {
    this.$checkDestroyed()
    return new Promise((resolve, reject) => {
      let timeout = null
      try {
        if (this._awaitBind.has(bind)) {
          throw new Error('already bound to: ' + bind)
        }

        this._socket.bind(bind)

        timeout = setTimeout(() => {
          reject(new Error('timeout binding to: ' + bind))
        }, 1000)

        this._awaitBind.set(bind, { timeout, resolve, reject })
      } catch (e) {
        clearTimeout(timeout)
        reject(e)
      }
    })
  }

  /**
   * handle the zmq `bind` event
   * @param {string} the bind endpoint that was bound
   * @private
   */
  _handleBind (bind) {
    if (this._destroyed) return
    const ref = this._awaitBind.get(bind)
    if (!ref) return
    clearTimeout(ref.timeout)
    ref.resolve()
  }

  /**
   * run periodically to free up memory from disconnected sockets
   * @private
   */
  _pruneClients () {
    if (this._destroyed) return
    const now = Date.now()
    for (let [zmqid, ref] of this._clients.entries()) {
      if (now - ref.last > 3000) {
        this.emit('clientRemove', zmqid)
        this._clients.delete(zmqid)
      }
    }
  }

  /**
   * when we get a new client connection, start tracking some data
   * @private
   */
  _tickle (zmqid) {
    if (this._destroyed) return
    if (this._clients.has(zmqid)) {
      this._clients.get(zmqid).last = Date.now()
    } else {
      this._clients.set(zmqid, {
        last: Date.now()
      })
      this.emit('clientAdd', zmqid)
    }
  }

  /**
   * we have received a message from a client socket, identify / distribute
   * @private
   */
  _handleMessage (...args) {
    if (this._destroyed) return
    try {
      if (args.length !== 3) {
        throw new Error('wrong msg size: ' + args.length)
      }
      const zmqid = args[0].toString('hex')
      this._tickle(zmqid)
      const type = args[2].readUInt8(0)
      switch (type) {
        case msg.Message.PING:
          this._handlePing(zmqid, msgpack.decode(args[2].slice(1)))
          break
        case msg.Message.CALL:
          this._handleCall(zmqid, msgpack.decode(args[2].slice(1)))
          break
        case msg.Message.CALL_OK:
          this._handleCallOk(zmqid, msgpack.decode(args[2].slice(1)))
          break
        case msg.Message.CALL_FAIL:
          this._handleCallFail(zmqid, msgpack.decode(args[2].slice(1)))
          break
        default:
          throw new Error('unhandled message type: ' + type)
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
  _handlePing (zmqid, data) {
    if (this._destroyed) return
    this._send(zmqid, msg.Message.PONG, [
      data[0], Date.now()
    ])
  }

  /**
   * we received a call, forward it to our implementor
   * @private
   */
  async _handleCall (zmqid, data) {
    if (this._destroyed) return
    try {
      const result = await this.$timeoutPromise((resolve, reject) => {
        this.emit('call', {
          data: Buffer.from(data[1]),
          resolve,
          reject
        })
      }, 2000)
      this._send(zmqid, msg.Message.CALL_OK, [
        data[0],
        result
      ])
    } catch (e) {
      this._callFail(zmqid, data[0], e)
    }
  }

  /**
   * client response to a call we sent out
   * @private
   */
  _handleCallOk (zmqid, msg) {
    this.$resolveWaiting(msg[0], msg[1])
  }

  /**
   * client response to a call we sent out
   * @private
   */
  _handleCallFail (zmqid, msg) {
    this.$rejectWaiting(msg[0], msg[1])
  }

  /**
   * fail response to a call the client sent
   * @private
   */
  _callFail (zmqid, messageId, e) {
    this._send(zmqid, msg.Message.CALL_FAIL, [
      messageId,
      e.stack || e.toString()
    ])
  }

  /**
   * Actually send data out on the socket
   * @private
   */
  _send (zmqid, type, data) {
    if (this._destroyed) return
    this._socket.send([
      Buffer.from(zmqid, 'hex'),
      Buffer.alloc(0),
      Buffer.concat([
        Buffer.from([type]),
        msgpack.encode(data)
      ])
    ])
  }
}

// export
exports.IpcServer = IpcServer
