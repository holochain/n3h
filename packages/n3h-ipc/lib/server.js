/*!
IPC Server represents an ipc listening socket designed to expose the functionality of a running p2p connection process.

Clients should connect to this._socket to send / receive messages from the p2p network.
*/

const zmq = require('zeromq')

const msg = require('./msg-types')
const { AsyncClass } = require('@holochain/n3h-common')

/**
 * IPC control api server
 * @example
 * const srv = new IpcServer()
 * await srv.bind(['ipc://my-socket.ipc', 'tcp://*:12345'])
 */
class IpcServer extends AsyncClass {
  /**
   * create a new ipc server instance
   */
  async init () {
    await super.init()

    super.$pushDestructor(() => {
      this._clients = null
      this._awaitBind = null
      this._socket.close()
      this._socket = null
      clearInterval(this._pruneClientsTimer)
    })

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
      this._handleBind(b, this._socket.last_endpoint)
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
   * broadcast an event to all clients
   */
  send (name, data) {
    this.$checkDestroyed()
    for (let zmqid of this._clients.keys()) {
      this._send(zmqid, name, data)
    }
  }

  sendOne (zmqid, name, data) {
    this.$checkDestroyed()
    this._send(zmqid, name, data)
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
  _handleBind (bind, endpoint) {
    if (this.$isDestroyed()) return
    const ref = this._awaitBind.get(bind)
    if (!ref) return
    clearTimeout(ref.timeout)
    ref.resolve(endpoint)
  }

  /**
   * run periodically to free up memory from disconnected sockets
   * @private
   */
  _pruneClients () {
    if (this.$isDestroyed()) return
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
    if (this.$isDestroyed()) return
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
    if (this.$isDestroyed()) return
    try {
      if (args.length !== 4) {
        throw new Error('wrong msg size: ' + args.length)
      }
      const fromZmqId = args[0].toString('hex')
      this._tickle(fromZmqId)
      const { name, data } = msg.decode(args[2], args[3])
      if (name === 'ping') {
        this._send(fromZmqId, 'pong', {
          orig: data.sent,
          recv: Date.now()
        })
      }
      this.emit('message', {
        name,
        data,
        fromZmqId
      })
    } catch (e) {
      console.error(e)
      process.exit(1)
    }
  }

  /**
   * Actually send data out on the socket
   * @private
   */
  _send (zmqid, name, data) {
    if (this.$isDestroyed()) return
    const enc = msg.encode(name, data)
    this._socket.send([
      Buffer.from(zmqid, 'hex'),
      Buffer.alloc(0),
      enc.name,
      enc.data
    ])
  }
}

// export
exports.IpcServer = IpcServer
