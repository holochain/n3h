/*!
IPC Client represents an ipc listening socket designed to connect to a running p2p connection process.
*/

const zmq = require('zeromq')

const msg = require('./msg-types')
const { AsyncClass } = require('@holochain/n3h-common')

/**
 * IPC connection client helper
 * @example
 * const cli = new IpcClient('ipc://my-socket.ipc')
 * await cli.connect('ipc://my-socket.ipc')
 * // or
 * await cli.connect('tcp://127.0.0.1:12345')
 */
class IpcClient extends AsyncClass {
  /**
   * create a new IpcClient instance
   */
  async init () {
    await super.init()
    this.$pushDestructor(() => {
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
          }, 10000)
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

        this._send('ping', {
          sent: Date.now()
        })

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

  send (name, data) {
    this.$checkDestroyed()
    this._send(name, data)
  }

  // -- private -- //

  /**
   * we recieved a message from the server, dispatch it
   * @private
   */
  _handleMessage (...args) {
    if (this.$isDestroyed()) return
    if (args.length !== 4) {
      throw new Error('wrong msg size: ' + args.length)
    }
    const { name, data } = msg.decode(args[2], args[3])
    if (name === 'ping') {
      this._send('pong', {
        orig: data.sent,
        recv: Date.now()
      })
    }
    this.emit('message', {
      name,
      data
    })
  }

  /**
   * Actually send data out to the server
   * @private
   */
  _send (name, data) {
    if (this.$isDestroyed()) return
    const enc = msg.encode(name, data)
    this._socket.send([
      msg.SRV_ID,
      Buffer.alloc(0),
      enc.name,
      enc.data
    ])
  }
}

// export
exports.IpcClient = IpcClient
