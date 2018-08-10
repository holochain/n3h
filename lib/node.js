const EventEmitter = require('events')
const crypto = require('crypto')

const msgpack = require('msgpack-lite')
const { MoSocket } = require('mosocket')

const protocol = {
  l3h: require('./protocol/l3h')
}

/**
 */
class Node extends EventEmitter {
  /**
   */
  constructor (config) {
    super()
    this._config = config
    this._socket = new MoSocket(config.mosocket)
    this._allNodes = new Map()

    this._protocol = protocol.l3h.install(this)

    this._socket.on('connection', (proxy) => {
      console.log('connected in session', proxy)
      this._initRemote(proxy)
    })
  }

  /**
   */
  bind (ma) {
    this._checkGossip()
    return this._socket.bind(ma)
  }

  /**
   */
  async connect (ma) {
    this._checkGossip()
    const proxy = await this._socket.connect(ma)
    console.log('connected out session', proxy)
    this._initRemote(proxy)
  }

  /**
   */
  close () {
    clearInterval(this._gossipTimer)
    this._gossipTimer = null
    this._socket.close()
    this._socket = null
  }

  /**
   */
  getListeningAddrs () {
    return this._socket.getListeningAddrs()
  }

  // -- protected -- //

  $checkGossip (endpoints) {
    for (let ep of endpoints) {
      if (ep[0] !== this._config.nodeId.id && !this._allNodes.has(ep[0])) {
        console.log('new endpoint found:', ep)
        this._allNodes.set(ep[0], {}) // dummy
        this.connect(ep[1])
      }
    }
  }

  // -- private -- //

  async _initRemote (proxy) {
    const result = await this._protocol.v([proxy])
    result.proxy = proxy
    this._allNodes.set(result.remoteId, result)
    console.log(this._config.nodeId.id, 'found node', result.remoteId, result.remoteEndpoint)
    this._checkGossip()
    this._gossip()
  }

  _checkGossip () {
    if (this._gossipTimer) {
      return
    }
    this._gossipTimer = setInterval(() => {
      this._gossip()
    }, 100)
  }

  async _gossip () {
    if (typeof this._lastGossipIndex !== 'number') {
      this._lastGossipIndex = -1
    }
    this._lastGossipIndex++;
    if (this._lastGossipIndex >= this._allNodes.size) {
      this._lastGossipIndex = 0
    }
    const rem = Array.from(this._allNodes.values())[this._lastGossipIndex]

    this._protocol.w([rem.proxy])
  }
}

exports.Node = Node
