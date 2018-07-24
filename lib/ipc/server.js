const EventEmitter = require('events')

const zmq = require('zeromq')
const msgpack = require('msgpack-lite')

const common = require('./common')

/**
 * IPC control api server
 */
class Server extends EventEmitter {
  /**
   */
  constructor (bind) {
    super()

    this.socket = null
    this.clients = {}

    this.pruneClientsTimer = setInterval(() => {
      this._pruneClients()
    }, 2000)

    this.startPromise = new Promise((resolve, reject) => {
      let toBind = {}

      const bindTimeout = setTimeout(() => {
        reject(new Error('timeout binding to: ' + Object.keys(toBind)))
      }, 1000)

      this.socket = zmq.socket('router')
      this.socket.setsockopt(zmq.options.identity, common.SRV_ID)
      this.socket.on('message', (...args) => {
        this._handleMessage(...args)
      })
      this.socket.on('error', (...args) => {
        console.error(args)
        process.exit(1)
      })

      this.socket.on('bind', (binding) => {
        console.log('bind', binding)
        delete toBind[binding]
        if (Object.keys(toBind).length < 1) {
          clearTimeout(bindTimeout)
          resolve()
        }
      })
      for (let b of bind) {
        toBind[b] = true
        this.socket.bind(b)
      }
    })
  }

  /**
   */
  ready () {
    return this.startPromise
  }

  /**
   */
  close () {
    this.removeAllListeners()
    this.setMaxListeners(0)
    this.socket.close()
    this.socket = null
    clearInterval(this.pruneClientsTimer)
  }

  /**
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
   */
  _pruneClients () {
    const now = Date.now()
    const b4list = Object.keys(this.clients)
    for (let id in this.clients) {
      const client = this.clients[id]
      if (now - client.last > 3000) {
        delete this.clients[id]
      }
    }
    const a4list = Object.keys(this.clients)
    if (b4list.length !== a4list.length) {
      console.log('clientList: ' + JSON.stringify(a4list))
    }
  }

  /**
   */
  _tickle (id) {
    if (id in this.clients) {
      this.clients[id].last = Date.now()
    } else {
      this.clients[id] = {
        last: Date.now()
      }
      console.log('clientList: ' + JSON.stringify(Object.keys(this.clients)))
    }
  }

  /**
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
   */
  _handlePing (id, start) {
    this._send(id, common.MSG_SRV.PONG, [
      start, Date.now()
    ])
  }

  /**
   */
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

  /**
   */
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

  /**
   */
  async _trackEmit (id, locId, fn) {
    try {
      const timeout = setTimeout(() => {
        throw new Error('timeout')
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
   */
  _respOk (id, data) {
    this._send(id, common.MSG_SRV.RESP_OK, data)
  }

  /**
   */
  _respFail (id, err) {
    try {
      this._send(id, common.MSG_SRV.RESP_FAIL, [
        0, // undefined error, check error messag in idx 1
        err.stack || err.toString()
      ])
    } catch (e) {
      console.error(e)
      process.exit(1)
    }
  }

  /**
   */
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

  /**
   */
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

exports.Server = Server
