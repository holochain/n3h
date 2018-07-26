/*!
IPC Client represents an ipc listening socket designed to connect to a running p2p connection process.
*/

const EventEmitter = require('events')

const zmq = require('zeromq')
const msgpack = require('msgpack-lite')

const common = require('./msg-types')

/**
 * IPC connection client helper
 * @example
 * const IpcClient = require('n3h').ipc.Client
 * const cli = new IpcClient('ipc://my-socket.ipc')
 * // or
 * const cli = new IpcClient('tcp://127.0.0.1:12345')
 */
class Client extends EventEmitter {
  /**
   * Connects to a ZeroMQ p2p IPC socket server endpoint.
   * @param {string} endpoint - the endpoint to connect to
   */
  constructor (endpoint) {
    super()

    this._nextWaitingId = Math.random()
    this._waiting = {}
    this._socket = zmq.socket('router')
    this._socket.on('message', (...args) => {
      this._gotServerMessage()
      this._handleMessage(...args)
    })
    this._socket.on('error', (...args) => {
      console.error(args)
      process.exit(1)
    })
    this._socket.connect(endpoint)

    this._gotServerMessage = null
    this._stopHeartbeatTimers = null

    this._startPromise = new Promise((resolve, reject) => {
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
   * @return {Promise} - when we have successfully established a connection
   */
  ready () {
    return this._startPromise
  }

  /**
   * Close the socket, and remove all event listeners.
   * This client cannot be used again, create a new one.
   */
  close () {
    this._stopHeartbeatTimers()
    this.removeAllListeners()
    this.setMaxListeners(0)
    this._socket.close()
    this._socket = null
    this._waiting = null
  }

  /**
   * Send an extra ping to the server, you probably don't need to call this.
   */
  ping () {
    this._send(common.MSG_CLI.PING, Date.now())
  }

  /**
   * Transmit a `send` message over the p2p network
   * @param {Buffer} toAddress - the destination p2p node address
   * @param {Buffer} data - the message content
   */
  send (toAddress, data) {
    if (!(toAddress instanceof Buffer) || !(data instanceof Buffer)) {
      throw new Error('expected two buffers')
    }
    const id = this._nextId()
    const promise = this._trackMessage(id, 'send', 1000)

    this._send(common.MSG_CLI.SEND, [
      id,
      toAddress,
      data
    ])

    return promise
  }

  /**
   * Transmit a `call` message over the p2p network
   * @param {Buffer} toAddress - the destination p2p node address
   * @param {Buffer} data - the message content
   */
  call (toAddress, data) {
    if (!(toAddress instanceof Buffer) || !(data instanceof Buffer)) {
      throw new Error('expected two buffers')
    }
    const id = this._nextId()
    const responsePromise = this._trackMessage(id, 'call', 5000)
    const callPromise = new Promise((resolve, reject) => {
      this._trackMessage(id, 'send', 1000).then((...args) => {
        resolve(...args)
      }, (e) => {
        reject(e)

        // we need to kill the responsePromise, it will never come
        const trueId = 'call:' + id
        if (!(trueId in this._waiting)) {
          return
        }
        this._waiting[trueId].reject(e)
      })
    })

    this._send(common.MSG_CLI.CALL, [
      id,
      id,
      toAddress,
      data
    ])

    return { callPromise, responsePromise }
  }

  /**
   * Transmit a `callResp` message over the p2p network
   * @param {Buffer} messageId - the origin id sent in the `call` we are responding to
   * @param {Buffer} toAddress - the destination p2p node address
   * @param {Buffer} data - the message content
   */
  callResp (messageId, toAddress, data) {
    if (!(messageId instanceof Buffer) || !(toAddress instanceof Buffer) || !(data instanceof Buffer)) {
      throw new Error('expected three buffers')
    }
    const id = this._nextId()
    const promise = this._trackMessage(id, 'send', 1000)

    this._send(common.MSG_CLI.CALL_RESP, [
      id,
      messageId,
      toAddress,
      data
    ])

    return promise
  }

  // -- private -- //

  /**
   * Get a new unique messageId buffer
   * @private
   */
  _nextId () {
    let id = this._nextWaitingId + 0.0001 + Math.random()
    return Buffer.from(id.toString(36))
  }

  /**
   * Watch for correlated messages from the server
   * @private
   */
  _trackMessage (id, idType, timeout) {
    return new Promise(async (resolve, reject) => {
      try {
        const trueId = idType + ':' + id

        const timeoutStack = (new Error('timeout')).stack
        const timer = setTimeout(() => {
          delete this._waiting[trueId]
          reject(new Error('timeout, inner-stack: ' + timeoutStack))
        }, timeout)

        this._waiting[trueId] = {
          resolve: (...args) => {
            delete this._waiting[trueId]
            clearTimeout(timer)
            resolve(...args)
          },
          reject: (e) => {
            delete this._waiting[trueId]
            clearTimeout(timer)
            reject(e)
          }
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  /**
   * we recieved a message from the server, dispatch it
   * @private
   */
  _handleMessage (...args) {
    if (args.length !== 3) {
      throw new Error('wrong msg size: ' + args.length)
    }
    const type = args[2].readUInt8(0)
    switch (type) {
      case common.MSG_SRV.PONG:
        this._handlePong(msgpack.decode(args[2].slice(1)))
        break
      case common.MSG_SRV.RESP_OK:
        this._handleResp(msgpack.decode(args[2].slice(1)))
        break
      case common.MSG_SRV.RESP_FAIL:
        this._handleRespFail(msgpack.decode(args[2].slice(1)))
        break
      case common.MSG_SRV.RECV_SEND:
        this._handleRecvSend(msgpack.decode(args[2].slice(1)))
        break
      case common.MSG_SRV.RECV_CALL:
        this._handleRecvCall(msgpack.decode(args[2].slice(1)))
        break
      case common.MSG_SRV.RECV_CALL_RESP:
        this._handleRecvCallResp(msgpack.decode(args[2].slice(1)))
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
    // console.log('got pong', {
    //   toServerMs: msg[1] - msg[0],
    //   roundTripMs: Date.now() - msg[0]
    // })
  }

  /**
   * we received a success responce from a sent `send`, `call`, or `callResp`
   * @private
   */
  _handleResp (msg) {
    const trueId = 'send:' + msg[0]
    if (!(trueId in this._waiting)) {
      return
    }
    this._waiting[trueId].resolve()
  }

  /**
   * we received a failed responce from a sent `send`, `call`, or `callResp`
   * @private
   */
  _handleRespFail (msg) {
    const trueId = 'send:' + msg[0]
    if (!(trueId in this._waiting)) {
      return
    }
    this._waiting[trueId].reject(new Error(msg[2]))
  }

  /**
   * we got a `send` from another p2p node
   * @private
   */
  _handleRecvSend (msg) {
    this.emit('recvSend', {
      fromAddress: msg[0],
      data: msg[1]
    })
  }

  /**
   * we got a `call` from another p2p node
   * @private
   */
  _handleRecvCall (msg) {
    this.emit('recvCall', {
      messageId: msg[0],
      fromAddress: msg[1],
      data: msg[2]
    })
  }

  /**
   * we got a `callResp` from another p2p node
   * @private
   */
  _handleRecvCallResp (msg) {
    const trueId = 'call:' + msg[0]
    msg = {
      messageId: msg[0],
      fromAddress: msg[1],
      data: msg[2]
    }
    if (trueId in this._waiting) {
      this._waiting[trueId].resolve(msg)
    }
    this.emit('recvCallResp', msg)
  }

  /**
   * Actually send data out to the server
   * @private
   */
  _send (type, data) {
    if (data) {
      data = Buffer.concat([
        Buffer.from([type]),
        msgpack.encode(data)
      ])
    } else {
      data = Buffer.from([type])
    }
    this._socket.send([
      common.SRV_ID,
      Buffer.alloc(0),
      data
    ])
  }
}

// export
exports.Client = Client
