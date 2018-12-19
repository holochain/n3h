const path = require('path')
const os = require('os')
const { URL } = require('url')

const { AsyncClass, mkdirp, $p } = require('@holochain/n3h-common')
const { IpcServer } = require('@holochain/n3h-ipc')
const { LibP2pBundle } = require('@holochain/n3h-mod-message-libp2p')

const { Mem } = require('./mem')

const PeerInfo = require('peer-info')
const PeerId = require('peer-id')

const tweetlog = require('@holochain/tweetlog')
tweetlog.set('t')

/// in hackmode, we need to always output on stderr
tweetlog.listen((l, t, ...a) => {
  console.error(`(${t}) [${l}] ${a.map(a => a.stack || (Array.isArray(a) || typeof a === 'object') ? JSON.stringify(a) : a.toString()).join(' ')}`)
})

const log = tweetlog('@mock@')

class N3hMock extends AsyncClass {
  async init () {
    await super.init()

    this._memory = {}
    this._peerBook = {}

    this._gossipState = {
      lastPeerIndex: 0,
      pauseUntil: 0
    }

    this._workDir = 'N3H_WORK_DIR' in process.env
      ? process.env.N3H_WORK_DIR
      : path.resolve(path.join(
        os.homedir(), '.nh3'))

    await mkdirp(this._workDir)
    process.chdir(this._workDir)

    this._ipcUri = 'N3H_IPC_SOCKET' in process.env
      ? process.env.N3H_IPC_SOCKET
      : 'ipc://' + path.resolve(path.join(
        os.homedir(), '.n3h', 'n3h-ipc.socket'))

    const tmpUri = new URL(this._ipcUri.replace('*', '0'))
    if (tmpUri.protocol === 'ipc:') {
      await mkdirp(path.dirname(tmpUri.pathname))
    }

    await Promise.all([
      this._initIpc(),
      this._initP2p()
    ])

    // make sure this is output despite our log settings
    console.log('#IPC-BINDING#:' + this._ipc.boundEndpoint)
    for (let binding of this._p2p.getBindings()) {
      console.log('#P2P-BINDING#:' + binding)
    }
    console.log('#IPC-READY#')

    this._gossipTimer = setInterval(() => this._checkGossip(), 200)
  }

  async run () {
    log.t('running')
  }

  // -- private -- //

  async _initIpc () {
    this._ipc = await new IpcServer()

    this._ipc.on('clientAdd', id => {
      log.t('clientAdd', id)
    })
    this._ipc.on('clientRemove', id => {
      log.t('clientAdd', id)
    })
    this._ipc.on('message', opt => this._handleIpcMessage(opt))
    this._ipc.boundEndpoint = (await this._ipc.bind(this._ipcUri))[0]

    log.t('bound to', this._ipc.boundEndpoint)
  }

  async _initP2p () {
    const peerInfo = this._peerInfo = new PeerInfo(await $p(PeerId.create.bind(
      PeerId, { bits: 512 })))

    peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0')

    this._p2p = await new LibP2pBundle({
      peerInfo
    })

    this._p2p.on('peerConnected', id => {
      this._peerBookInsert(id)
    })

    this._p2p.on('handleSend', opt => this._handleP2pMessage(opt))

    log.i('p2p bound', JSON.stringify(this._p2p.getBindings(), null, 2))
  }

  _peerBookInsert (id) {
    if (!(id in this._peerBook)) {
      this._peerBook[id] = {
        lastGossip: 0
      }
    }
  }

  _handleIpcMessage (opt) {
    if (opt.name === 'ping') {
      return
    }

    let ref
    let tId
    if (opt.name === 'json' && typeof opt.data.method === 'string') {
      switch (opt.data.method) {
        case 'requestState':
          this._ipc.send('json', {
            method: 'state',
            state: 'ready',
            id: this._p2p.getId(),
            bindings: this._p2p.getBindings()
          })
          return
        case 'connect':
          this._p2p.connect(opt.data.address)
          return
        case 'trackApp':
          this._track(opt.data.dnaHash, opt.data.agentId)
          return
        case 'send':
          ref = this._getMemRef(opt.data.dnaHash)
          if (!(opt.data.toAgentId in ref.agentToTransportId)) {
            this._ipc.send('json', {
              method: 'failureResult',
              dnaHash: opt.data.dnaHash,
              toAgentId: opt.data.fromAgentId,
              errorInfo: 'No routing for agent id "' + opt.data.toAgentId + '" aborting send'
            })
            return
          }
          tId = ref.agentToTransportId[opt.data.toAgentId]
          this._p2p.send(tId, {
            type: 'handleSend',
            _id: opt.data._id,
            dnaHash: opt.data.dnaHash,
            toAgentId: opt.data.toAgentId,
            fromAgentId: opt.data.fromAgentId,
            data: opt.data.data
          })
          return
        case 'handleSendResult':
          ref = this._getMemRef(opt.data.dnaHash)
          if (!(opt.data.toAgentId in ref.agentToTransportId)) {
            this._ipc.send('json', {
              method: 'failureResult',
              dnaHash: opt.data.dnaHash,
              toAgentId: opt.data.fromAgentId,
              errorInfo: 'No routing for agent id "' + opt.data.toAgentId + '" aborting handleSendResult'
            })
            return
          }
          tId = ref.agentToTransportId[opt.data.toAgentId]
          this._p2p.send(tId, {
            type: 'sendResult',
            _id: opt.data._id,
            dnaHash: opt.data.dnaHash,
            toAgentId: opt.data.toAgentId,
            fromAgentId: opt.data.fromAgentId,
            data: opt.data.data
          })
          return
        case 'publishDht':
          this._getMemRef(opt.data.dnaHash).mem.insert({
            type: 'dht',
            _id: opt.data._id,
            agentId: opt.data.agentId,
            address: opt.data.address,
            content: opt.data.content
          })
          return
        case 'publishDhtMeta':
          this._getMemRef(opt.data.dnaHash).mem.insert({
            type: 'dhtMeta',
            _id: opt.data._id,
            agentId: opt.data.agentId,
            address: opt.data.address,
            attribute: opt.data.attribute,
            content: opt.data.content
          })
          return
        case 'getDht':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          this._ipc.send('json', opt.data)
          return
        case 'getDhtResult':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          this._ipc.send('json', opt.data)
          return
        case 'getDhtMeta':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          this._ipc.send('json', opt.data)
          return
        case 'getDhtMetaResult':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          this._ipc.send('json', opt.data)
          return
      }
    }

    throw new Error('unexpected input ' + JSON.stringify(opt))
  }

  _handleP2pMessage (opt) {
    // log.w('@@@@', opt.data.type, JSON.stringify(opt.data))
    switch (opt.data.type) {
      case 'gossipHashHash':
        this._processGossipHashHash(opt.from, opt.data.gossipHashHash)

        const gossipHashHash = this._fullGossipHashHash()

        // log.t('gossip (resp) with', opt.from, JSON.stringify(gossipHashHash))

        this._p2p.send(opt.from, {
          type: 'gossipHashHashResp',
          gossipHashHash
        })
        return
      case 'gossipHashHashResp':
        this._processGossipHashHash(opt.from, opt.data.gossipHashHash)
        return
      case 'gossipRequestLocHashes':
        this._processRequestLocHashes(opt.from, opt.data.locList)
        return
      case 'gossipHashList':
        this._processGossipHashList(opt.from, opt.data.hashList)
        return
      case 'getData':
        this._processGetData(opt.from, opt.data.dnaHash, opt.data.hash)
        return
      case 'getDataResp':
        this._processGetDataResp(opt.data.dnaHash, opt.data.data)
        return
      case 'handleSend':
        this._ipc.send('json', {
          method: 'handleSend',
          _id: opt.data._id,
          dnaHash: opt.data.dnaHash,
          toAgentId: opt.data.toAgentId,
          fromAgentId: opt.data.fromAgentId,
          data: opt.data.data
        })
        return
      case 'sendResult':
        this._ipc.send('json', {
          method: 'sendResult',
          _id: opt.data._id,
          dnaHash: opt.data.dnaHash,
          toAgentId: opt.data.toAgentId,
          fromAgentId: opt.data.fromAgentId,
          data: opt.data.data
        })
        return
    }

    throw new Error('unexpected message ' + opt.from + ' ' + JSON.stringify(
      opt.data))
  }

  _processGossipHashHash (fromId, gossipHashHash) {
    // we got a gossip response! push back next step 2 seconds
    this._pauseGossip(null, 2000)

    const locList = []
    for (let hh of gossipHashHash) {
      if (hh.dnaHash in this._memory) {
        const ref = this._memory[hh.dnaHash].mem
        const ll = ref.getGossipLocListForGossipHashHash(hh.gossipHashHash)
        if (ll.length > 0) {
          locList.push({
            dnaHash: hh.dnaHash,
            locList: ll
          })
        }
      }
    }

    if (locList.length < 1) {
      return
    }

    this._p2p.send(fromId, {
      type: 'gossipRequestLocHashes',
      locList
    })
  }

  _processRequestLocHashes (fromId, locList) {
    // log.t('requestLocHashes', fromId, JSON.stringify(locList))

    // we got a gossip response! push back next step 2 seconds
    this._pauseGossip(null, 2000)

    const hashList = []
    for (let ll of locList) {
      if (ll.dnaHash in this._memory) {
        const ref = this._memory[ll.dnaHash].mem
        const hl = ref.getGossipHashesForGossipLocList(ll.locList)
        if (hl.length > 0) {
          hashList.push({
            dnaHash: ll.dnaHash,
            hashList: hl
          })
        }
      }
    }

    this._p2p.send(fromId, {
      type: 'gossipHashList',
      hashList
    })
  }

  _processGossipHashList (fromId, hashList) {
    // log.t('hashList', fromId, JSON.stringify(hashList))

    // we got a gossip response! push back next step 2 seconds
    this._pauseGossip(null, 2000)

    for (let hl of hashList) {
      if (hl.dnaHash in this._memory) {
        const ref = this._memory[hl.dnaHash].mem
        for (let hash of hl.hashList) {
          if (!ref.has(hash)) {
            this._p2p.send(fromId, {
              type: 'getData',
              dnaHash: hl.dnaHash,
              hash
            })
          }
        }
      }
    }
  }

  _processGetData (fromId, dnaHash, hash) {
    // log.t('getData', fromId, dnaHash, hash)
    if (dnaHash in this._memory) {
      const ref = this._memory[dnaHash].mem
      if (ref.has(hash)) {
        const data = ref.get(hash)
        this._p2p.send(fromId, {
          type: 'getDataResp',
          dnaHash: dnaHash,
          data
        })
      }
    }
  }

  _processGetDataResp (dnaHash, data) {
    if (dnaHash in this._memory) {
      const ref = this._memory[dnaHash].mem
      if (ref.insert(data)) {
        log.t('newGossip', dnaHash, JSON.stringify(data))
      }
    }
  }

  _getMemRef (dnaHash) {
    if (!(dnaHash in this._memory)) {
      const mem = new Mem()
      mem.registerIndexer((store, hash, data) => {
        if (data && data.type === 'dht') {
          this._ipc.send('json', {
            method: 'storeDht',
            _id: data._id,
            dnaHash,
            agentId: data.agentId,
            address: data.address,
            content: data.content
          })
        }
      })
      mem.registerIndexer((store, hash, data) => {
        if (data && data.type === 'dhtMeta') {
          log.e('got dhtMeta', data)
          this._ipc.send('json', {
            method: 'storeDhtMeta',
            _id: data._id,
            dnaHash,
            agentId: data.agentId,
            address: data.address,
            attribute: data.attribute,
            content: data.content
          })
        }
      })
      this._memory[dnaHash] = {
        mem,
        agentToTransportId: mem.registerIndexer((store, hash, data) => {
          if (data && data.type === 'agent') {
            store[data.agentId] = data.transportId
            this._ipc.send('json', {
              method: 'peerConnected',
              dnaHash: dnaHash,
              agentId: data.agentId
            })
          }
        })
      }
    }
    return this._memory[dnaHash]
  }

  _track (dnaHash, agentId) {
    const ref = this._getMemRef(dnaHash)
    ref.mem.insert({
      type: 'agent',
      dnaHash: dnaHash,
      agentId: agentId,
      transportId: this._p2p.getId()
    })
  }

  _fullGossipHashHash () {
    const out = []
    for (let dnaHash in this._memory) {
      out.push({
        dnaHash,
        gossipHashHash: this._memory[dnaHash].mem.getGossipHashHash()
      })
    }
    return out
  }

  _pauseGossip (msg, ms) {
    if (msg) {
      // log.i(msg)
    }
    const until = Date.now() + ms
    if (this._gossipState.pauseUntil < until) {
      this._gossipState.pauseUntil = until
    }
  }

  _checkGossip () {
    setImmediate(() => {
      if (this._gossipState.pauseUntil < Date.now()) {
        this._gossip()
      }
    })
  }

  async _gossip () {
    // give the next step some space
    this._pauseGossip(null, 1000)

    const peerCount = Object.keys(this._peerBook).length
    if (peerCount < 1) {
      this._pauseGossip('no peers, pausing gossip for .5 seconds', 500)
      return
    }

    const gs = this._gossipState
    if (gs.lastPeerIndex >= peerCount) {
      gs.lastPeerIndex = 0
      this._pauseGossip('circled the peerBook, pausing gossip for .5 seconds', 500)
      return
    }

    const thisGossipPeer = Object.keys(this._peerBook)[gs.lastPeerIndex++]
    const peerRef = this._peerBook[thisGossipPeer]
    if (Date.now() - peerRef.lastGossip < 1000) {
      this._pauseGossip('peer too recent, pauing gossip for .5 seconds', 500)
      return
    }
    peerRef.lastGossip = Date.now()

    const gossipHashHash = this._fullGossipHashHash()

    // log.t('gossip with', thisGossipPeer, JSON.stringify(gossipHashHash))

    this._p2p.send(thisGossipPeer, {
      type: 'gossipHashHash',
      gossipHashHash
    })
  }
}

exports.N3hMock = N3hMock
