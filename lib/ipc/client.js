const EventEmitter = require('events')

const zmq = require('zeromq')
const msgpack = require('msgpack-lite')

const common = require('./common')

/**
 */
class Client extends EventEmitter {
  /**
   */
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

  /**
   */
  ready () {
    return this.startPromise
  }

  /**
   */
  close () {
    this.socket.close()
    this.socket = null
    this.waiting = null
    clearInterval(this.heartbeatTimer)
  }

  /**
   */
  ping () {
    this._send(common.MSG_CLI.PING, Date.now())
  }

  /**
   */
  send (toAddress, data) {
    return this._trackMessage(async (id) => {
      this._send(common.MSG_CLI.SEND, [
        id, toAddress, data
      ])
    })
  }

  /**
   */
  call (msgId, toAddress, data) {
    return this._trackMessage(async (id) => {
      this._send(common.MSG_CLI.CALL, [
        id,
        msgId,
        toAddress,
        data
      ])
    })
  }

  // -- private -- //

  /**
   */
  _nextId () {
    let id = this.nextWaitingId++
    id = id.toString(16)
    if (id.length % 2 === 1) {
      id = '0' + id
    }
    return Buffer.from(id, 'hex')
  }

  /**
   */
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

  /**
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
   */
  _handlePong (msg) {
    console.log('got pong', {
      toServerMs: msg[1] - msg[0],
      roundTripMs: Date.now() - msg[0]
    })
    clearInterval(this.startPoll)
    this.startResolve()
  }

  /**
   */
  _handleResp (msg) {
    if (!(msg[0] in this.waiting)) {
      throw new Error('errant message id from server')
    }
    this.waiting[msg[0]].resolve()
    delete this.waiting[msg[0]]
  }

  /**
   */
  _handleRespFail (msg) {
    if (!(msg[0] in this.waiting)) {
      throw new Error('errant fail message from server: ' + JSON.stringify(msg))
    }
    this.waiting[msg[0]].reject(msg[1])
    delete this.waiting[msg[0]]
  }

  /**
   */
  _handleRecvSend (msg) {
    this.emit('recvSend', {
      fromAddress: msg[0],
      data: msg[1]
    })
  }

  /**
   */
  _handleRecvCall (msg) {
    this.emit('recvCall', {
      messageId: msg[0],
      fromAddress: msg[1],
      data: msg[2]
    })
  }

  /**
   */
  _handleRecvCallResp (msg) {
    this.emit('recvCallResp', {
      messageId: msg[0],
      fromAddress: msg[1],
      data: msg[2]
    })
  }

  /**
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
    this.socket.send([
      common.SRV_ID,
      Buffer.alloc(0),
      data
    ])
  }
}

exports.Client = Client
