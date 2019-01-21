const crypto = require('crypto')

const gossip = require('./gossip')

const {
  AsyncClass,
  Executor
} = require('@holochain/n3h-common')
const { Dht } = require('@holochain/n3h-mod-spec')
const DhtEvent = Dht.DhtEvent

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

/**
 * sha256 hash a string as utf8 bytes, return base64 of digest
 */
function getHash (str) {
  const hasher = crypto.createHash('sha256')
  hasher.update(Buffer.from(str, 'utf8'))
  return hasher.digest().toString('base64')
}

/**
 * generate a unified stringifyable blob of input (* type)
 * that is consistent for hash / map types (sorted, not insertion order)
 * should be able to getHash(JSON.stringify(sortedHashableBlob(x)))
 * and always get the same hash, no matter what types are in x
 */
function sortedHashableBlob (x) {
  let keys = null
  let out = null

  let type = typeof x

  if (!x) {
    type = 'null'
  } else if (Array.isArray(x)) {
    type = 'array'
  } else if (x instanceof Map) {
    type = 'map'
  } else if (x instanceof Set) {
    type = 'set'
  }

  switch (type) {
    case 'array':
      return x.map(x => sortedHashableBlob(x))
    case 'map':
      keys = Array.from(x.keys()).sort()
      out = []
      for (let k of keys) {
        out.push([k, sortedHashableBlob(x.get(k))])
      }
      return out
    case 'object':
      keys = Object.keys(x).sort()
      out = []
      for (let k of keys) {
        out.push([k, sortedHashableBlob(x[k])])
      }
      return out
    case 'set':
      return Array.from(x.keys()).sort()
    case 'null':
      return null
    default:
      return x
  }
}

/**
 */
function sortedHash (x) {
  const blob = sortedHashableBlob(x)
  const json = JSON.stringify(blob)
  return getHash(json)
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
    this._peerList = []
    this._dataStore = new Map()

    this._lastGossipIdx = -1
    this._gossipStack = []

    this._locHashes = new Map()

    this._dataFetchWait = new Map()

    this.$pushDestructor(async () => {
      await this._exec.destroy()
      this._spec = null
      this._exec = null
      this._peerStore = null
      this._peerList = []
      this._dataStore = null
      this._gossipStack = null
      this._locHashes = null
      this._dataFetchWait = null
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

  /**
   */
  getPeerLocal (peerAddress) {
    this.$checkDestroyed()

    const loc = getLoc(peerAddress)
    if (!this._peerStore.has(loc)) {
      return null
    }

    const lRef = this._peerStore.get(loc)

    if (!lRef.has(peerAddress)) {
      return null
    }

    const pRef = lRef.get(peerAddress)

    // not just renaming,
    // we also don't want them changing our object directly
    return {
      peerTransport: pRef.transport,
      peerData: pRef.data,
      peerTs: pRef.ts
    }
  }

  /**
   */
  async fetchDataLocal (dataAddress) {
    this.$checkDestroyed()

    const loc = getLoc(dataAddress)
    if (!this._dataStore.has(loc)) {
      return null
    }

    const lRef = this._dataStore.get(loc)

    if (!lRef.has(dataAddress)) {
      return null
    }

    return this._fetchDataLocal(dataAddress)
  }

  // -- private -- //

  /**
   */
  _getPeerRef (peerAddress) {
    const loc = getLoc(peerAddress)
    if (!this._peerStore.has(loc)) {
      this._peerStore.set(loc, new Map())
    }
    const lRef = this._peerStore.get(loc)
    if (!lRef.has(peerAddress)) {
      lRef.set(peerAddress, {
        transport: '',
        data: '',
        ts: 0
      })
    }
    return lRef.get(peerAddress)
  }

  /**
   */
  _getDataRef (dataAddress) {
    const loc = getLoc(dataAddress)
    if (!this._dataStore.has(loc)) {
      this._dataStore.set(loc, new Map())
    }
    const lRef = this._dataStore.get(loc)
    if (!lRef.has(dataAddress)) {
      lRef.set(dataAddress, new Set())
    }
    return lRef.get(dataAddress)
  }

  /**
   */
  _fetchDataLocal (dataAddress) {
    return new Promise((resolve, reject) => {
      try {
        const id = this.$createUid()

        this._dataFetchWait.set(id, {
          resolve, reject
        })

        this._spec.$emitEvent(DhtEvent.dataFetch(id, dataAddress))
      } catch (e) {
        reject(e)
      }
    })
  }

  /**
   */
  _calcState () {
    const peers = []

    this._locHashes.clear()

    const getRef = (loc) => {
      if (!this._locHashes.has(loc)) {
        this._locHashes.set(loc, [null, null])
      }
      return this._locHashes.get(loc)
    }

    for (let [l, lRef] of this._peerStore) {
      for (let k of lRef.keys()) {
        getRef(l)[0] = lRef
        peers.push(k)
      }
    }

    this._peerList = peers.sort()

    for (let [l, lRef] of this._dataStore) {
      getRef(l)[1] = lRef
    }

    for (let [l, lRef] of this._locHashes) {
      this._locHashes.set(l, sortedHash(lRef))
    }
  }

  /**
   */
  async _gossip () {
    if (this.$isDestroyed()) {
      return
    }

    // peek for wait
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

    // next peer
    if (!this._gossipStack.length) {
      ++this._lastGossipIdx

      if (!this._peerList || this._lastGossipIdx >= this._peerList.length) {
        // either we have no peers
        // or we just wrapped our peer list
        // wait for half a second
        this._lastGossipIdx = -1
        this._gossipStack.push({
          type: 'wait',
          until: Date.now() + 500
        })
      }

      const peerAddress = this._peerList[this._lastGossipIdx]
      const ref = this._getPeerRef(peerAddress)

      const msgId = this.$createUid()

      this._spec.$emitEvent(DhtEvent.gossipTo(
        [ref.transport], gossip.locHashes(this._locHashes)))

      this._gossipStack.push({
        type: 'waitInitialHashThingy',
        peerAddress,
        msgId
      })
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
      this._calcState()

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

      this._calcState()

      // in a sharded dht, we might trigger a publish here
      // but we can just wait for the sync cycle
    }
  }

  /**
   */
  async _onDataFetchResponse (task) {
    if (this._dataFetchWait.has(task.msgId)) {
      const ref = this._dataFetchWait.get(task.msgId)
      this._dataFetchWait.delete(task.msgId)
      ref.resolve(task.data)
    } else {
      console.log('ignoring bad msgId', task)
    }
  }
}

exports.DhtBackendFullsync = DhtBackendFullsync
