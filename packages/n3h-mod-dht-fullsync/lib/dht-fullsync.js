const crypto = require('crypto')

const gossip = require('./gossip')

const {
  AsyncClass,
  Executor,
  $sleep
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

    this._thisPeer = initOptions.thisPeer
    if (
      !this._thisPeer ||
      !DhtEvent.isEvent(this._thisPeer) ||
      this._thisPeer.type !== 'peerHoldRequest'
    ) {
      throw new Error('thisPeer required on dht init')
    }

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

    this.post(this._thisPeer)

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
    return DhtEvent.peerHoldRequest(
      peerAddress,
      pRef.transport,
      pRef.data,
      pRef.ts
    )
  }

  /**
   */
  async fetchPeer (peerAddress) {
    this.$checkDestroyed()

    let peer = this.getPeerLocal(peerAddress)

    if (peer) {
      return peer
    }

    // for full sync... let's just wait a bit to see if we get one...
    const start = Date.now()
    while (Date.now() - start < 2000) {
      await $sleep(200)
      peer = this.getPeerLocal(peerAddress)
      if (peer) {
        return peer
      }
    }

    return null
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
      } else if (ref.type === 'waitPeer') {
        if (ref.until > Date.now()) {
          return
        }
        console.error('TIMEOUT gossiping with peer', ref.peerAddress)
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
        return
      }

      const peerAddress = this._peerList[this._lastGossipIdx]

      // skip if this peer is us :)
      if (peerAddress === this._thisPeer.peerAddress) {
        return setImmediate(() => this._gossip())
      }

      const msgId = this.$createUid()

      this._spec.$emitEvent(DhtEvent.gossipTo(
        [peerAddress], gossip.locHashes(msgId, this._locHashes)))

      // give this peer 3 seconds
      // if the whole back-n-forth takes longer,
      // then they are too laggy, move on to the next
      this._gossipStack.push({
        type: 'waitPeer',
        until: Date.now() + 3000,
        peerAddress,
        msgId
      })
    }
  }

  /**
   */
  _gossipIsCurrentMsgId (msgId) {
    const ref = this._gossipStack[this._gossipStack.length - 1]
    if (ref && ref.type === 'waitPeer' && ref.msgId === msgId) {
      return true
    }
    return false
  }

  /**
   */
  _gossipClearMsgId (msgId) {
    if (this._gossipIsCurrentMsgId(msgId)) {
      this._gossipStack.pop()
      return setImmediate(() => this._gossip())
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
  async _onRemoteGossipBundle (task) {
    const parsed = gossip.parse(task.bundle)
    const msgId = parsed.msgId

    switch (parsed.type) {
      case 'locHashes': {
        const requestLocList = []
        const sendList = []
        for (let [l, lHash] of parsed.map) {
          if (!this._locHashes.has(l)) {
            // we are missing this loc
            requestLocList.push(l)
          } else if (this._locHashes.get(l) !== lHash) {
            // this loc differs
            sendList.push(l)
            requestLocList.push(l)
          }
        }
        for (let l of this._locHashes.keys()) {
          if (!parsed.map.has(l)) {
            // remote is missing this loc
            sendList.push(l)
          }
        }
        const {
          peerAddressToTsMap, dataAddressToHashListMap
        } = this._enumerateAddressMapsForLocList(sendList)

        const bundle = gossip.hashDiff(msgId,
          peerAddressToTsMap, dataAddressToHashListMap, requestLocList)
        const evt = DhtEvent.gossipTo(
          [task.fromPeerAddress], bundle)
        this._spec.$emitEvent(evt)
        break
      }
      case 'hashDiff': {
        if (!this._gossipIsCurrentMsgId(msgId)) {
          return
        }
        // first send hashes for any locs they requested
        const {
          peerAddressToTsMap, dataAddressToHashListMap
        } = this._enumerateAddressMapsForLocList(parsed.requestLocList)
        if (peerAddressToTsMap.size || dataAddressToHashListMap.size) {
          const bundle = gossip.hashDiffResp(msgId,
            peerAddressToTsMap, dataAddressToHashListMap
          )
          const evt = DhtEvent.gossipTo(
            [task.fromPeerAddress], bundle)
          this._spec.$emitEvent(evt)
        }
        // next check if they sent any addresses we are missing
        const {
          peerAddressList, dataAddressList
        } = this._enumerateMissingAddresses(
          parsed.peerAddressToTsMap,
          parsed.dataAddressToHashListMap
        )
        if (peerAddressList.length || dataAddressList.length) {
          const bundle = gossip.fetchAddressList(msgId,
            peerAddressList, dataAddressList)
          const evt = DhtEvent.gossipTo(
            [task.fromPeerAddress], bundle)
          this._spec.$emitEvent(evt)
        } else {
          this._gossipClearMsgId(msgId)
        }
        break
      }
      case 'hashDiffResp': {
        // see if they sent any addresses we are missing
        const {
          peerAddressList, dataAddressList
        } = this._enumerateMissingAddresses(
          parsed.peerAddressToTsMap,
          parsed.dataAddressToHashListMap
        )
        if (peerAddressList.length || dataAddressList.length) {
          const bundle = gossip.fetchAddressList(msgId,
            peerAddressList, dataAddressList)
          const evt = DhtEvent.gossipTo(
            [task.fromPeerAddress], bundle)
          this._spec.$emitEvent(evt)
        }
        break
      }
      case 'fetchAddressList': {
        const peerMap = this._gatherPeerMap(parsed.peerAddressList)
        const bundle = gossip.fetchAddressListResp(msgId, peerMap, null)
        const evt = DhtEvent.gossipTo([task.fromPeerAddress], bundle)
        this._spec.$emitEvent(evt)
        break
      }
      case 'fetchAddressListResp': {
        this._handlePeerMap(parsed.peerMap)
        this._gossipClearMsgId(msgId)
        break
      }
      default:
        throw new Error('unexpected remote gossip type ' + parsed.type)
    }
  }

  /**
   */
  _enumerateAddressMapsForLocList (locs) {
    const peerAddressToTsMap = new Map()
    const dataAddressToHashListMap = new Map()

    for (let loc of locs) {
      if (this._peerStore.has(loc)) {
        const pRef = this._peerStore.get(loc)
        for (let [peerAddress, peer] of pRef) {
          peerAddressToTsMap.set(
            peerAddress, peer.ts)
        }
      }
      if (this._dataStore.has(loc)) {
        const dRef = this._dataStore.get(loc)
        for (let [dataAddress, hashSet] of dRef) {
          dataAddressToHashListMap.set(
            dataAddress, Array.from(hashSet.keys()))
        }
      }
    }

    return { peerAddressToTsMap, dataAddressToHashListMap }
  }

  /**
   */
  _enumerateMissingAddresses (peerAddressToTsMap, dataAddressToHashListMap) {
    const peerAddressList = []
    const dataAddressList = []
    for (let [peerAddress, ts] of peerAddressToTsMap) {
      const loc = getLoc(peerAddress)
      if (this._peerStore.has(loc)) {
        const pRef = this._peerStore.get(loc)
        if (pRef.has(peerAddress) && pRef.get(peerAddress).ts >= ts) {
          continue
        }
      }
      peerAddressList.push(peerAddress)
    }
    for (let [dataAddress, hashList] of dataAddressToHashListMap) {
      let wantThisAddress = false
      const loc = getLoc(dataAddress)
      if (this._dataStore.has(loc)) {
        const dSet = this._dataStore.get(dataAddress)
        for (let h of hashList) {
          if (!dSet.has(h)) {
            wantThisAddress = true
            break
          }
        }
      } else {
        wantThisAddress = true
      }
      if (wantThisAddress) {
        dataAddressList.push(dataAddress)
      }
    }

    return { peerAddressList, dataAddressList }
  }

  /**
   */
  _gatherPeerMap (peerAddressList) {
    const out = new Map()
    for (let peerAddress of peerAddressList) {
      const loc = getLoc(peerAddress)
      if (this._peerStore.has(loc)) {
        let pRef = this._peerStore.get(loc)
        if (pRef.has(peerAddress)) {
          pRef = pRef.get(peerAddress)
          out.set(peerAddress, JSON.stringify(pRef))
        }
      }
    }
    return out
  }

  /**
   */
  _handlePeerMap (peerMap) {
    for (let [peerAddress, peer] of peerMap) {
      const loc = getLoc(peerAddress)
      if (this._peerStore.has(loc)) {
        let pRef = this._peerStore.get(loc)
        if (pRef.has(peerAddress)) {
          pRef = this._peerStore.get(loc)
          if (pRef.ts && pRef.ts >= peer.ts) {
            continue
          }
        }
      }
      peer = JSON.parse(peer)
      const evt = DhtEvent.peerHoldRequest(
        peerAddress, peer.transport, peer.data, peer.ts)
      console.log('WANT NEW PEER', evt)
      this._spec.$emitEvent(evt)
    }
  }

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
