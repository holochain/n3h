const crypto = require('crypto')

const {
  AsyncClass,
  Executor
} = require('@holochain/n3h-common')

const evtType2Fn = {
  remoteGossipBundle: '_onRemoteGossipBundle',
  peerHoldRequest: '_onPeerHoldRequest',
  dataHoldRequest: '_onDataHoldRequest',
  dataFetchResponse: '_onDataFetchResponse'
}

// bit of a hack, treat the address as utf8,
// then xor into a single byte
function getLoc (address) {
  const buf = Buffer.from(address, 'utf8')
  let loc = buf.readInt8(0)
  for (let i = 1; i < buf.byteLength; ++i) {
    loc = loc ^ buf.readInt8(i)
  }
  return loc.toString(16)
}

function getHash (str) {
  const hasher = crypto.createHash('sha256')
  hasher.update(Buffer.from(str, 'utf8'))
  return hasher.digest().toString('base64')
}

/**
 */
class DhtBackendFullsync extends AsyncClass {
  /**
   */
  async init (spec, initOptions) {
    await super.init()

    this._spec = spec
    this._exec = await new Executor()

    this._exec.on('task', t => this._onTask(t))

    this._exec.schedule('gossip', 100)
    this._exec.on('gossip', () => this._gossip())

    this._peerStore = new Map()
    this._dataStore = new Map()

    this._lastGossipIdx = -1
    this._gossipStack = []

    this.$pushDestructor(async () => {
      await this._exec.destroy()
      this._spec = null
      this._exec = null
      this._peerStore = null
      this._dataStore = null
      this._gossipStack = null
    })
  }

  /**
   */
  post (evt) {
    if (this.$isDestroyed()) {
      return
    }

    this._exec.post(evt)
  }

  // -- private -- //

  /**
   */
  _getPeerRef (peerAddress) {
    const loc = getLoc(peerAddress)
    if (!this._peerStore.has(loc)) {
      this._peerStore.set(loc, new Map())
    }
    const aRef = this._peerStore.get(loc)
    if (!aRef.has(peerAddress)) {
      aRef.set(peerAddress, {
        transport: '',
        data: '',
        ts: 0
      })
    }
    return aRef.get(peerAddress)
  }

  /**
   */
  _getDataRef (dataAddress) {
    const loc = getLoc(dataAddress)
    if (!this._dataStore.has(loc)) {
      this._dataStore.set(loc, new Map())
    }
    const aRef = this._dataStore.get(loc)
    if (!aRef.has(dataAddress)) {
      aRef.set(dataAddress, new Set())
    }
    return aRef.get(dataAddress)
  }

  /**
   */
  _calcGossipHashes () {
    // TODO
  }

  /**
   */
  async _gossip () {
    if (this.$isDestroyed()) {
      return
    }

    // peek
    if (this._gossipStack.length) {
      const ref = this._gossipStack[this._gossipStack.length - 1]
      if (ref.type === 'wait') {
        if (ref.until > Date.now()) {
          return
        }
        this._gossipStack.pop()
        return setImmediate(() => this._gossip())
      }
    }
  }

  /**
   */
  async _onTask (task) {
    const fnName = evtType2Fn[task.type]
    if (!(fnName in this)) {
      throw new Error('unimplemented event type: ' + task.type)
    }
    await this[fnName](task)
  }

  // -- specific event (task) handlers -- //

  /**
   */
  async _onPeerHoldRequest (task) {
    const ref = this._getPeerRef(task.peerAddress)
    let updated = false

    if (ref.transport !== task.peerTransport) {
      updated = true
      ref.transport = task.peerTransport
    }

    if (ref.data !== task.peerData) {
      updated = true
      ref.data = task.peerData
    }

    if (ref.ts !== task.peerTs) {
      updated = true
      ref.ts = task.peerTs
    }

    if (updated) {
      this._calcGossipHashes()

      // in a sharded dht, we might trigger a publish here
      // but we can just wait for the sync cycle
    }
  }

  /**
   */
  async _onDataHoldRequest (task) {
    const ref = this._getDataRef(task.dataAddress)
    const hash = getHash(task.data)
    if (!ref.has(hash)) {
      ref.add(hash)

      this._calcGossipHashes()

      // in a sharded dht, we might trigger a publish here
      // but we can just wait for the sync cycle
    }
  }
}

exports.DhtBackendFullsync = DhtBackendFullsync
