const EventEmitter = require('events')

const { Connection: TcpCon } = require('./tcp')
const message = require('./message')

/**
 */
class Session extends EventEmitter {
  /**
   */
  constructor (mosocket, sessionId) {
    super()

    this._mosocket = mosocket
    this._sessionId = sessionId
    this._tcp = null

    this._inMessageHandlers = new Map()
    this._outMessageHandlers = new Map()
  }

  /**
   */
  getProxy () {
    return this._sessionId.toString('base64')
  }

  /**
   */
  close () {
    if (this._tcp) {
      this._tcp.close()
    }
    this._inMessageHandlers = null
    this._outMessageHandlers = null
    this._tcp = null
    this._sessionId = null
    this.removeAllListeners()
    this.setMaxListeners(0)
  }

  /**
   */
  getAddr () {
    const addr = this._tcp.getAddr()
    // TODO - add udp component
    return addr.toString()
  }

  /**
   */
  send (msg) {
    this._tcp.send(msg)
  }

  /**
   */
  assumeTcpConnection (con) {
    if (!(con instanceof TcpCon)) {
      throw new Error('session can only assume tcp connections')
    }
    if (this._sessionId !== con._sessionId) {
      throw new Error('session id mismatch')
    }
    if (this._tcp) {
      this._tcp.close()
    }
    this._tcp = con
    con.on('error', (err) => {
      this.emit('error', err)
      this.close()
    })
    con.on('close', () => {
      this.emit('close')
      this.close()
    })
    con.on('message', (msg) => {
      this._handleMessage(msg)
    })
  }

  // -- protected -- //

  $registerInMessageHandler (msgId, handler) {
    if (this._inMessageHandlers.has(msgId)) {
      throw new Error('messageid already in use: ' + msgId)
    }
    this._inMessageHandlers.set(msgId, handler)
  }

  $unregisterInMessageHandler (msgId) {
    this._inMessageHandlers.delete(msgId)
  }

  async $triggerInProtocolMessage (msg) {
    const handler = this._inMessageHandlers.get(msg.msgId)
    if (!handler) {
      throw new Error('no handler found for msgId ' + msg.msgId)
    }
    await handler.onMessage(msg)
  }

  $registerOutMessageHandler (msgId, handler) {
    if (this._outMessageHandlers.has(msgId)) {
      throw new Error('messageid already in use: ' + msgId)
    }
    this._outMessageHandlers.set(msgId, handler)
  }

  $unregisterOutMessageHandler (msgId) {
    this._outMessageHandlers.delete(msgId)
  }

  async $triggerOutProtocolMessage (msg) {
    const handler = this._outMessageHandlers.get(msg.msgId)
    if (!handler) {
      throw new Error('no handler found for msgId ' + msg.msgId)
    }
    await handler.onMessage(msg)
  }

  // -- private -- //

  _handleMessage (msg) {
    const parsed = message.parse(msg)
    switch (parsed.type) {
      case message.MsgType.noticeReliable:
      case message.MsgType.preauthReq:
      case message.MsgType.reqData:
        parsed.proxy = this.getProxy()
        this._mosocket.$triggerInProtocolMessage(parsed)
        break
      case message.MsgType.preauthAck:
      case message.MsgType.preauthAccept:
      case message.MsgType.preauthStop:
      case message.MsgType.resData:
        parsed.proxy = this.getProxy()
        this._mosocket.$triggerOutProtocolMessage(parsed)
        break
      default:
        throw new Error('unhandled msgtype: 0x' + parsed.type.toString(16))
    }
  }
}

exports.Session = Session
