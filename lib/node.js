const EventEmitter = require('events')
// const crypto = require('crypto')

// const msgpack = require('msgpack-lite')
const { MoSocket } = require('mosocket')
const { Server: IpcServer } = require('node-p2p-ipc')

const mnemonic = require('./mnemonic/mnemonic')

const protocol = {
  l3h: require('./protocol/l3h')
}

/**
 */
function _friend (b) {
  if (!(b instanceof Buffer)) {
    b = Buffer.from(b, 'base64')
  }
  return mnemonic.toMnemonic(b.slice(0, 4)).join('-')
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
      console.log('connected in session', _friend(proxy))
      this._initRemote(proxy)
    })
  }

  /**
   */
  async init () {
    console.log('initializing node, ipc socket: ' + this._config.ipc.socket)
    this._ipc = new IpcServer([this._config.ipc.socket])
    await this._ipc.ready()
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
    console.log('connected out session', _friend(proxy))
    this._initRemote(proxy)
  }

  /**
   */
  close () {
    clearInterval(this._gossipTimer)
    this._gossipTimer = null
    this._socket.close()
    this._socket = null
    this._ipc.close()
    this._ipc = null
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
        console.log('new endpoint found:', _friend(ep[0]), ep[1])
        this._allNodes.set(ep[0], {}) // dummy
        this.connect(ep[1])
      }
    }
  }

  // -- private -- //

  async _initRemote (proxy) {
    const result = await this._protocol.v([proxy])
    //console.log('validate', result)
    result.proxy = proxy
    this._allNodes.set(result.remoteId, result)
    console.log(_friend(this._config.nodeId.id), 'found node', _friend(result.remoteId), result.remoteEndpoint)
    this._checkGossip()
    this._gossip()
  }

  _checkGossip () {
    if (this._gossipTimer) {
      return
    }
    this._gossipTimer = setInterval(() => {
      this._gossip()
    }, 1000)
  }

  async _gossip () {
    if (typeof this._lastGossipIndex !== 'number') {
      this._lastGossipIndex = -1
    }
    this._lastGossipIndex++
    if (this._lastGossipIndex >= this._allNodes.size) {
      this._lastGossipIndex = 0
    }
    const rem = Array.from(this._allNodes.values())[this._lastGossipIndex]

    if (!rem || !rem.proxy) {
      return
    }
    this._protocol.w([rem.proxy])
  }
}

Node._friend = _friend

exports.Node = Node
