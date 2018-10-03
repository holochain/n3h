/*!
IPC Client represents an ipc listening socket designed to connect to a running p2p connection process.
*/

const zmq = require('zeromq')
const msgpack = require('msgpack-lite')

const msg = require('./msg-types')
const common = require('./common')

/**
 * IPC connection client helper
 * @example
 * const cli = new IpcClient('ipc://my-socket.ipc')
 * await cli.connect('ipc://my-socket.ipc')
 * // or
 * await cli.connect('tcp://127.0.0.1:12345')
 */
class IpcClient extends common.EventClass {
  /**
   * create a new IpcClient instance
   */
  constructor () {
    super(() => {
      if (typeof this._stopHeartbeatTimers === 'function') {
        this._stopHeartbeatTimers()
        this._stopHeartbeatTimers = null
      }
      this._gotServerMessage = null
      this._socket.close()
      this._socket = null
    })

    this._connected = false
    this._socket = zmq.socket('router')
    this._socket.on('message', (...args) => {
      if (typeof this._gotServerMessage === 'function') {
        this._gotServerMessage()
      }
      this._handleMessage(...args)
    })
    this._socket.on('error', (...args) => {
      console.error(args)
      process.exit(1)
    })

    this._gotServerMessage = null
    this._stopHeartbeatTimers = null
  }

  /**
   * Connect this instance to a server socket
   * @param {string} endpoint - the zmq socket to connect to
   * @return {Promise} - resolved if connection is a success
   */
  connect (endpoint) {
    this.$checkDestroyed()
    if (this._connected) {
      throw new Error('ipc client can only connect to one endpoint')
    }
    this._connected = true

    this._socket.connect(endpoint)

    return new Promise((resolve, reject) => {
      let continueRunning = true
      let connectTimeout = null
      let heartbeatTimer = null
      let pollInterval = 1

      const setConnectTimeout = () => {
        if (continueRunning && !connectTimeout) {
          const timeoutStack = (new Error('timeout')).stack
          connectTimeout = setTimeout(() => {
            throw new Error('timeout, inner-stack: ' + timeoutStack)
          }, 3000)
        }
      }

      const clearConnectTimeout = () => {
        clearTimeout(connectTimeout)
        connectTimeout = null
      }

      const nextPoll = () => {
        if (!continueRunning) {
          return
        }

        setConnectTimeout()

        this.ping()

        heartbeatTimer = setTimeout(() => {
          nextPoll()
        }, pollInterval)
        pollInterval *= 2
      }
      nextPoll()

      this._gotServerMessage = () => {
        pollInterval = 1000
        clearConnectTimeout()
        setConnectTimeout()
        resolve()
      }

      this._stopHeartbeatTimers = () => {
        continueRunning = false
        clearConnectTimeout()
        clearTimeout(heartbeatTimer)
      }
    })
  }

  /**
   * Send an extra ping to the server, you probably don't need to call this.
   */
  ping () {
    this.$checkDestroyed()
    this._send(msg.Message.PING, [Date.now()])
  }

  /**
   * Transmit a `call` message to the ipc server
   * @param {Buffer} data - the message content
   * @return {Buffer} the response data
   */
  call (data) {
    this.$checkDestroyed()
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer')
    }
    const messageId = this.$nextId()
    const promise = this.$trackMessage(messageId, 2000)

    this._send(msg.Message.CALL, [
      messageId,
      data
    ])

    return promise
  }

  // -- private -- //

  /**
   * we recieved a message from the server, dispatch it
   * @private
   */
  _handleMessage (...args) {
    if (this._destroyed) return
    if (args.length !== 3) {
      throw new Error('wrong msg size: ' + args.length)
    }
    const type = args[2].readUInt8(0)
    switch (type) {
      case msg.Message.PONG:
        this._handlePong(msgpack.decode(args[2].slice(1)))
        break
      case msg.Message.CALL:
        this._handleCall(msgpack.decode(args[2].slice(1)))
        break
      case msg.Message.CALL_OK:
        this._handleCallOk(msgpack.decode(args[2].slice(1)))
        break
      case msg.Message.CALL_FAIL:
        this._handleCallFail(msgpack.decode(args[2].slice(1)))
        break
      default:
        throw new Error('unhandled message type: ' + type)
    }
  }

  /**
   * we received a pong message... don't do anything for now
   * @private
   */
  _handlePong (msg) {
    // if (this._destroyed) return
    // console.log('got pong', {
    //   toServerMs: msg[1] - msg[0],
    //   roundTripMs: Date.now() - msg[0]
    // })
  }

  /**
   * we have received a `call` respond to it
   * @private
   */
  async _handleCall (data) {
    if (this._destroyed) return
    try {
      const result = await this.$timeoutPromise((resolve, reject) => {
        this.emit('call', {
          data: Buffer.from(data[1]),
          resolve,
          reject
        })
      }, 2000)
      this._send(msg.Message.CALL_OK, [
        data[0],
        result
      ])
    } catch (e) {
      this._send(msg.Message.CALL_FAIL, [
        data[0],
        e.stack || e.toString()
      ])
    }
  }

  /**
   * we received a success response
   * @private
   */
  _handleCallOk (msg) {
    this.$resolveWaiting(msg[0], msg[1])
  }

  /**
   * we received a failed response
   * @private
   */
  _handleCallFail (msg) {
    this.$rejectWaiting(msg[0], msg[1])
  }

  /**
   * Actually send data out to the server
   * @private
   */
  _send (type, data) {
    if (this._destroyed) return
    if (data) {
      data = Buffer.concat([
        Buffer.from([type]),
        msgpack.encode(data)
      ])
    } else {
      data = Buffer.from([type])
    }
    this._socket.send([
      msg.SRV_ID,
      Buffer.alloc(0),
      data
    ])
  }
}

// export
exports.IpcClient = IpcClient
