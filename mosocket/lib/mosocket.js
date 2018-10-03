const EventEmitter = require('events')

const { Connection: TcpCon, Listener: TcpListener } = require('./tcp')
const { MultiAddr } = require('./multiaddr')
const { Session } = require('./session')
const protocol = require('./protocol')

/**
 */
class MoSocket extends EventEmitter {
  /**
   */
  constructor (config) {
    super()
    this._config = config
    this._listeners = []
    this._outgoing = []
    this._incoming = []
    this._sessions = new Map()
    this._protocols = new Map()
    this._nextMessageId = 0
  }

  /**
   */
  async bind (ma) {
    if (!ma) {
      ma = new MultiAddr()
    } else if (!(ma instanceof MultiAddr)) {
      ma = new MultiAddr(ma)
    }

    const tcpPort = ma.tcpPort || 0
    const udpPort = ma.udpPort || 0

    const hosts = ma.ipAddress ? [ma.ipAddress] : ['0.0.0.0', '::']

    await Promise.all(hosts.map((h) => {
      return this._bind(h, tcpPort, udpPort)
    }))
  }

  /**
   */
  async connect (ma) {
    if (!(ma instanceof MultiAddr)) {
      ma = new MultiAddr(ma)
    }

    if (!ma.ipAddress || !ma.tcpPort) {
      throw new Error('invalid multiaddr: ' + ma.toString())
    }

    const con = await TcpCon.create(this._config, ma)
    this._outgoing.push(con)
    const session = new Session(this, con._sessionId)
    session.assumeTcpConnection(con)
    this._trackSession(session)
    return session.getProxy()
  }

  /**
   */
  close () {
    for (let l of this._listeners) {
      l.close()
    }
    this._listeners = []
    for (let c of this._outgoing) {
      c.close()
    }
    this._outgoing = []
    for (let c of this._incoming) {
      c.close()
    }
    this._incoming = []
  }

  /**
   */
  getListeningAddrs () {
    const out = []
    for (let l of this._listeners) {
      for (let addr of l.getAddrs()) {
        out.push(addr)
      }
    }
    out.sort((a, b) => {
      a = a.rank({ needTcp: true })
      b = b.rank({ needTcp: true })
      if (a === b) {
        return 0
      } else if (a > b) {
        return 1
      }
      return -1
    })
    return out.map(o => o.toString())
  }

  /**
   */
  getAddr (proxy) {
    return this._sessions.get(proxy.toString()).getAddr()
  }

  /**
   */
  installProtocol (def) {
    const proto = protocol.create(this, def)
    if (this._protocols.has(proto._intTag)) {
      throw new Error('protocol intTag conflict: ' + proto._intTag)
    }
    this._protocols.set(proto._intTag, proto)
    return proto
  }

  // -- protected -- //

  /**
   */
  $nextMessageId () {
    return this._nextMessageId++
  }

  /**
   */
  $resolveProxy (proxy) {
    if (typeof proxy !== 'string') {
      proxy = proxy.toString()
    }
    const out = this._sessions.get(proxy)
    if (!(out instanceof Session)) {
      throw new Error('invalid session proxy reference: ' + proxy)
    }
    return out
  }

  /**
   */
  $triggerInProtocolMessage (msg) {
    if (msg.protoHash) {
      const proto = this._protocols.get(msg.protoHash)
      if (!(proto instanceof protocol.Protocol)) {
        throw new Error('bad protohash: ' + msg.protoHash)
      }
      proto.$triggerProtocolMessage(msg)
    } else if (typeof msg.msgId === 'number') {
      const session = this.$resolveProxy(msg.proxy)
      session.$triggerInProtocolMessage(msg)
    } else {
      throw new Error('unhandleable message: ' + JSON.stringify(msg))
    }
  }

  /**
   */
  $triggerOutProtocolMessage (msg) {
    if (typeof msg.msgId === 'number') {
      const session = this.$resolveProxy(msg.proxy)
      session.$triggerOutProtocolMessage(msg)
    } else {
      throw new Error('unhandleable message: ' + JSON.stringify(msg))
    }
  }

  // -- private -- //

  /**
   */
  async _bind (host, tcpPort, udpPort) {
    const ma = MultiAddr.fromParts(host, tcpPort, udpPort)
    const listener = await TcpListener.create(this._config, ma)
    listener.on('connection', (con) => {
      this._incoming.push(con)
      const session = new Session(this, con._sessionId)
      session.assumeTcpConnection(con)
      this._trackSession(session)
    })
    this._listeners.push(listener)

    for (let addr of listener.getAddrs()) {
      this.emit('bind', addr.toString())
    }
  }

  /**
   */
  _trackSession (session) {
    this._sessions.set(session.getProxy(), session)
    this.emit('connection', session.getProxy())
    session.on('error', e => {
      this.emit('sessionError', session.getProxy(), e)
    })
    session.on('close', () => {
      this.emit('sessionClose', session.getProxy())
    })
  }
}

for (let pname in protocol.Patterns) {
  MoSocket[pname] = protocol.Patterns[pname]
}

exports.MoSocket = MoSocket
