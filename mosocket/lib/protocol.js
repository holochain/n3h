const EventEmitter = require('events')

const mosodium = require('mosodium')

const message = require('./message')

const Patterns = exports.Patterns = {
  PATTERN_FIRST: 'first',
  PATTERN_NOTIFY_RELIABLE: 'notify-reliable'
}

/**
 * Protocol Stub Class
 */
class Protocol extends EventEmitter {
  /**
   */
  constructor (mosocket, name, version, protoName, intTag) {
    super()
    this._mosocket = mosocket
    this._name = name
    this._version = version
    this._protoName = protoName
    this._intTag = intTag
    this._handlerEntrypoints = new Map()
  }

  // -- marking all functions with $ so they don't clobber hooks -- //

  $getName () {
    return this._name
  }

  $getVersion () {
    return this._version
  }

  $getProtoName () {
    return this._protoName
  }

  $getIntTag () {
    return this._intTag
  }

  async $triggerProtocolMessage (msg) {
    const cb = this._handlerEntrypoints.get(msg.hookName)
    if (!cb) {
      throw new Error('bad entrypoint hook: ' + msg.hookName)
    }
    await cb(msg)
  }
}

exports.Protocol = Protocol

/**
 */
class Handler {
  /**
   */
  constructor (protoStub, hookName, hook, isOut, onClean) {
    this.$protoStub = protoStub
    this.$hookName = hookName
    this.$hook = hook
    this.$isOut = isOut
    this.$messageId = protoStub._mosocket.$nextMessageId()
    this.$registeredProxies = new Set()
    if (onClean) {
      this.$onClean = Array.isArray(onClean) ? onClean : [onClean]
    } else {
      this.$onClean = []
    }
    this.$onClean.push(() => {
      for (let p of this.$registeredProxies) {
        this.$unregisterMessageHandler(p)
      }
      this.$registeredProxies = null
      this.$protoStub = null
      this.$hookName = null
      this.$hook = null
      this.$messageId = null
      this.$onClean = null
    })
  }

  /**
   */
  clean () {
    for (let c of this.$onClean) {
      c()
    }
  }

  // -- protected -- //

  /**
   */
  $registerMessageHandler (proxies) {
    proxies = Array.isArray(proxies) ? proxies : [proxies]
    for (let proxy of proxies) {
      const session = this.$protoStub._mosocket.$resolveProxy(proxy)
      if (this.$isOut) {
        session.$registerOutMessageHandler(this.$messageId, this)
      } else {
        session.$registerInMessageHandler(this.$messageId, this)
      }
      this.$registeredProxies.add(proxy.toString())
    }
  }

  /**
   */
  $sendAll (data) {
    for (let p of this.$registeredProxies) {
      const session = this.$protoStub._mosocket.$resolveProxy(p)
      session.send(data)
    }
  }

  /**
   */
  $unregisterMessageHandler (proxy) {
    const session = this.$protoStub._mosocket.$resolveProxy(proxy)
    if (this.$isOut) {
      session.$unregisterOutMessageHandler(this.$messageId)
    } else {
      session.$unregisterInMessageHandler(this.$messageId)
    }
    this.$registeredProxies.delete(proxy)
  }
}

/**
 */
class HandlerFirstInitiator extends Handler {
  /**
   */
  constructor (protoStub, hookName, hook, resolve, reject) {
    super(protoStub, hookName, hook, true, () => {
      this.$resolve = null
      this.$reject = null
      this.$state = null
      this.$context = null
    })

    this.$context = {}

    this.$resolve = resolve
    this.$reject = reject

    this.$state = 'init'
  }

  /**
   */
  async initiate (proxies, args) {
    this.$registerMessageHandler(proxies)

    const data = await this.$hook.initiator.onPreauthReq(
      this.$context, ...args)

    const msg = message.newPreauthReq(
      this.$protoStub._intTag, this.$messageId, this.$hookName,
      data)

    this.$sendAll(msg)

    this.$state = 'await-ack'
  }

  /**
   */
  async onMessage (msg) {
    try {
      switch (this.$state) {
        case 'await-ack':
          // TODO - actually pay attention to acks...
          // for now wait for Accept / Stop
          if (msg.type === message.MsgType.preauthAck) {
            console.log('got ack')
            // ignore
          } else if (msg.type === message.MsgType.preauthAccept) {
            await this._doAccept(msg)
          } else if (msg.type === message.MsgType.preauthStop) {
            return this._fail(msg.text)
          } else {
            throw new Error('bad message type: 0x' + msg.type.toString(16))
          }
          break
        case 'await-resp':
          if (msg.type === message.MsgType.resData) {
            this._handleResp(msg)
          } else if (msg.type === message.MsgType.preauthStop) {
            return this._fail(msg.text)
          } else {
            throw new Error('bad message type: 0x' + msg.type.toString(16))
          }
          break
        default:
          throw new Error('unhandled state: ' + this.$state)
      }
    } catch (e) {
      this._fail(e)
    }
  }

  // -- private -- //

  async _doAccept (msg) {
    for (let p of this.$registeredProxies) {
      if (msg.proxy.toString() !== p) {
        this.$unregisterMessageHandler(p)
      }
    }

    const data = await this.$hook.initiator.onRequest(this.$context)

    const msgs = message.newRequest(this.$messageId, data)
    msgs.map((msg) => {
      this.$sendAll(msg)
    })

    this.$state = 'await-resp'
  }

  async _handleResp (msg) {
    const result = await this.$hook.initiator.onResponse(this.$context, msg)
    this.$resolve(result)
    this.clean()
  }

  _fail (e) {
    this.$reject(e)
    this.clean()
  }
}

/**
 */
class HandlerFirstResponder extends Handler {
  /**
   */
  constructor (protoStub, hookName, hook) {
    super(protoStub, hookName, hook, false, () => {
      this._preauthMsg = null
      this.$context = null
    })

    this.$context = {}
    this.$state = 'init'
  }

  /**
   */
  async initiate (msg) {
    this.$messageId = msg.msgId
    this.$registerMessageHandler(msg.proxy)

    try {
      await this.$hook.responder.onPreauthReq(this.$context, msg)
    } catch (e) {
      const stop = message.newPreauthStop(
        this.$messageId, e.stack || e.toString())
      this.$sendAll(stop)
      this.clean()
      return
    }

    const accept = message.newPreauthAccept(this.$messageId)
    this.$sendAll(accept)

    this.$state = 'await-req'
  }

  /**
   */
  onMessage (msg) {
    try {
      switch (this.$state) {
        case 'await-req':
          if (msg.type === message.MsgType.reqData) {
            if (msg.length !== msg.data.byteLength) {
              throw new Error('unimplemented reqDataCont')
            }
            this._handleRequest(msg)
          }
          break
        default:
          throw new Error('unhandled state: ' + this.$state)
      }
    } catch (e) {
      this._fail(e)
    }
  }

  // -- private -- //

  async _handleRequest (msg) {
    let result = null
    try {
      result = await this.$hook.responder.onRequest(
        this.$context, msg)
    } catch (e) {
      const stop = message.newPreauthStop(
        this.$messageId, e.stack || e.toString())
      this.$sendAll(stop)
      this.clean()
      return
    }

    const msgs = message.newResponse(this.$messageId, result)
    msgs.map((msg) => {
      this.$sendAll(msg)
    })

    this.clean()
  }

  _fail (e) {
    this.clean()
    throw e
  }
}

/**
 */
function _validateProxyParam (p) {
  if (Array.isArray(p)) {
    if (!p.length) {
      throw new Error('first parameter must be array of remote proxies')
    }
    return p.map((_p) => {
      if (!_p) throw new Error('bad proxy type ' + typeof _p)
      return _p.toString()
    })
  }
  if (p) {
    return [p.toString()]
  }
  throw new Error('first parameter must be array of remote proxies')
}

/**
 */
function _installPatternFirst (protoStub, hookName, hook) {
  protoStub[hookName] = (proxies, ...args) => {
    proxies = _validateProxyParam(proxies)
    return new Promise((resolve, reject) => {
      try {
        const handler = new HandlerFirstInitiator(
          protoStub, hookName, hook, resolve, reject)
        handler.initiate(proxies, args)
      } catch (e) {
        reject(e)
      }
    })
  }
  protoStub._handlerEntrypoints.set(hookName, async (msg) => {
    const handler = new HandlerFirstResponder(
      protoStub, hookName, hook)
    handler.initiate(msg)
  })
}

/**
 */
function _installPatternNotifyReliable (protoStub, hookName, hook) {
  protoStub[hookName] = async (proxies, ...args) => {
    proxies = _validateProxyParam(proxies)
    const data = await hook.initiator.onNotifyReliable(...args)
    const msg = message.newNoticeReliable(
      protoStub._intTag, hookName, data)
    for (let con of proxies) {
      const session = protoStub._mosocket.$resolveProxy(con)
      await session.send(msg)
    }
  }
  protoStub._handlerEntrypoints.set(hookName, hook.responder.onNotifyReliable)
}

/**
 */
exports.create = function protocolCreate (mosocket, def) {
  const protoName = def.name + '/' + def.version
  const intTag = mosodium.hash.toInt(mosodium.hash.sha256(
    Buffer.from(protoName, 'utf8')))

  const protoStub = new Protocol(
    mosocket, def.name, def.version, protoName, intTag)

  for (let hookName in def.hooks) {
    const hook = def.hooks[hookName]
    switch (hook.pattern) {
      case Patterns.PATTERN_FIRST:
        _installPatternFirst(protoStub, hookName, hook)
        break
      case Patterns.PATTERN_NOTIFY_RELIABLE:
        _installPatternNotifyReliable(protoStub, hookName, hook)
        break
      default:
        throw new Error('unrecognized pattern: ' + hook.pattern)
    }
  }

  return protoStub
}
