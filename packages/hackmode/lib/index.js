const path = require('path')
const os = require('os')
const { URL } = require('url')
const msgpack = require('msgpack-lite')

const { AsyncClass, mkdirp } = require('@holochain/n3h-common')
const { IpcServer } = require('@holochain/n3h-ipc')

const { P2p } = require('@holochain/n3h-mod-spec')
const { P2pBackendHackmodePeer } = require('./p2p-backend-hackmode-peer')

const { Mem } = require('./mem')

const tweetlog = require('@holochain/tweetlog')
const log = tweetlog('@hackmode@')

class N3hHackMode extends AsyncClass {
  async init (workDir) {
    await super.init()

    this._memory = {}
    this._peerBook = {}

    // Book: Array of entryAddress (or metaId) per dna
    this._publishedEntryBook = {}
    this._storedEntryBook = {}
    this._publishedMetaBook = {}
    this._storedMetaBook = {}

    this._requestBook = new Map()
    this._requestCount = 0

    this._gossipState = {
      lastPeerIndex: 0,
      pauseUntil: 0
    }

    this._workDir = workDir

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
    console.log('#P2P-BINDING#:' + this._p2p.getAdvertise())
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
    this._p2p = await new P2p(P2pBackendHackmodePeer, {
      dht: {},
      connection: {
        passphrase: 'hello',
        rsaBits: 1024, // TODO - use 4096 && config to 1024 for testing
        bind: ['wss://0.0.0.0:0/']
      },
      wssAdvertise: 'auto'
      // TODO wssRelayPeer
      // wssRelayPeers: [ bootstrap node ]
    })

    this._p2p.on('event', evt => this._handleP2pEvent(evt))

    const advertise = this._p2p.getAdvertise()
    log.i('p2p bound', advertise)
  }

  async _p2pSend (peerAddress, obj) {
    return this._p2p.publishReliable(
      [peerAddress],
      msgpack.encode(obj).toString('base64')
    )
  }

  _peerBookInsert (id) {
    if (!(id in this._peerBook)) {
      this._peerBook[id] = {
        lastGossip: 0
      }
    }
  }

  _handleIpcMessage (opt) {
    if (opt.name === 'ping' || opt.name === 'pong') {
      return
    }

    // log.t('Received IPC message: ', opt)

    let ref
    let tId
    let bucketId
    if (opt.name === 'json' && typeof opt.data.method === 'string') {
      switch (opt.data.method) {
        case 'failureResult':
          // Note: opt.data is a FailureResultData
          // Check if its a response to our own request
          bucketId = this._checkRequest(opt.data._id)
          if (bucketId !== '') {
            return
          }
          // if not relay to sender
          ref = this._getMemRef(opt.data.dnaAddress)
          if (!(opt.data.toAgentId in ref.agentToTransportId)) {
            // Sending failureResult failed...
            this._ipc.send('json', {
              method: 'failureResult',
              dnaAddress: opt.data.dnaAddress,
              _id: opt.data._id,
              toAgentId: opt.data.agentId,
              errorInfo: 'No routing for agent id "' + opt.data.requesterAgentId + '" aborting failureResult'
            })
            return
          }
          tId = ref.agentToTransportId[opt.data.toAgentId]
          this._p2pSend(tId, {
            type: 'failureResult',
            dnaAddress: opt.data.dnaAddress,
            _id: opt.data._id,
            toAgentId: opt.data.toAgentId,
            errorInfo: opt.data.errorInfo
          })
          return
        case 'requestState':
          this._ipc.send('json', {
            method: 'state',
            state: 'ready',
            id: this._p2p.getId(),
            bindings: [this._p2p.getAdvertise()]
          })
          return
        case 'connect':
          this._p2p.transportConnect(opt.data.address).then(() => {
            log.t('connected', opt.data.address)
          }, (err) => {
            log.e('connect (' + opt.data.address + ') failed', err.toString())
          })
          return
        case 'trackDna':
          this._track(opt.data.dnaAddress, opt.data.agentId)
          return
        case 'sendMessage':
          ref = this._getMemRef(opt.data.dnaAddress)
          if (!(opt.data.toAgentId in ref.agentToTransportId)) {
            this._ipc.send('json', {
              method: 'failureResult',
              dnaAddress: opt.data.dnaAddress,
              _id: opt.data._id,
              toAgentId: opt.data.fromAgentId,
              errorInfo: 'No routing for agent id "' + opt.data.toAgentId + '" aborting sendMessage'
            })
            return
          }
          tId = ref.agentToTransportId[opt.data.toAgentId]
          this._p2pSend(tId, {
            type: 'handleSendMessage',
            _id: opt.data._id,
            dnaAddress: opt.data.dnaAddress,
            toAgentId: opt.data.toAgentId,
            fromAgentId: opt.data.fromAgentId,
            data: opt.data.data
          })
          return
        case 'handleSendMessageResult':
          ref = this._getMemRef(opt.data.dnaAddress)
          if (!(opt.data.toAgentId in ref.agentToTransportId)) {
            this._ipc.send('json', {
              method: 'failureResult',
              dnaAddress: opt.data.dnaAddress,
              _id: opt.data._id,
              toAgentId: opt.data.fromAgentId,
              errorInfo: 'No routing for agent id "' + opt.data.toAgentId + '" aborting handleSendMessageResult'
            })
            return
          }
          tId = ref.agentToTransportId[opt.data.toAgentId]
          this._p2pSend(tId, {
            type: 'sendMessageResult',
            _id: opt.data._id,
            dnaAddress: opt.data.dnaAddress,
            toAgentId: opt.data.toAgentId,
            fromAgentId: opt.data.fromAgentId,
            data: opt.data.data
          })
          return
        case 'publishEntry':
          // Note: opt.data is a EntryData
          // Bookkeep
          this._bookkeepAddress(this._publishedEntryBook, opt.data.dnaAddress, opt.data.address)
          // publish
          this._getMemRef(opt.data.dnaAddress).mem.insert({
            type: 'dhtEntry',
            providerAgentId: opt.data.providerAgentId,
            address: opt.data.address,
            content: opt.data.content
          })
          return
        case 'publishMeta':
          // Note: opt.data is a DhtMetaData
          // Bookkeep
          this._bookkeepAddress(this._publishedMetaBook, opt.data.dnaAddress, opt.data.entryAddress)
          // publish
          this._getMemRef(opt.data.dnaAddress).mem.insertMeta({
            type: 'dhtMeta',
            providerAgentId: opt.data.providerAgentId,
            entryAddress: opt.data.entryAddress,
            attribute: opt.data.attribute,
            content: opt.data.content
          })
          return
        case 'fetchEntry':
          //  since we're fully connected, just redirect this back to itself for now...
          opt.data.method = 'handleFetchEntry'
          this._ipc.send('json', opt.data)
          return
        case 'handleFetchEntryResult':
          // Note: opt.data is a FetchEntryResultData
          // if this message is a response from our own request, do a publish
          if (this._requestBook.has(opt.data._id)) {
            this._requestBook.delete(opt.data._id)
            this._getMemRef(opt.data.dnaAddress).mem.insert({
              type: 'dhtEntry',
              providerAgentId: opt.data.providerAgentId,
              address: opt.data.address,
              content: opt.data.content
            })
            return
          }
          // Try sending back to requester
          ref = this._getMemRef(opt.data.dnaAddress)
          // Respond failureResult if requester not found
          if (!(opt.data.requesterAgentId in ref.agentToTransportId)) {
            this._ipc.send('json', {
              method: 'failureResult',
              dnaAddress: opt.data.dnaAddress,
              _id: opt.data._id,
              toAgentId: opt.data.requesterAgentId,
              errorInfo: 'No routing for agent id "' + opt.data.requesterAgentId + '" aborting handleFetchEntryResult'
            })
            return
          }
          tId = ref.agentToTransportId[opt.data.requesterAgentId]
          this._p2pSend(tId, {
            type: 'fetchEntryResult',
            _id: opt.data._id,
            dnaAddress: opt.data.dnaAddress,
            requesterAgentId: opt.data.requesterAgentId,
            providerAgentId: opt.data.providerAgentId,
            agentId: opt.data.agentId,
            address: opt.data.address,
            content: opt.data.content
          })
          return
        case 'fetchMeta':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          opt.data.method = 'handleFetchMeta'
          this._ipc.send('json', opt.data)
          return
        case 'handleFetchMetaResult':
          // Note: opt.data is a FetchMetaResultData
          // if its from our own request do a publish
          if (this._requestBook.has(opt.data._id)) {
            this._requestBook.delete(opt.data._id)
            this._getMemRef(opt.data.dnaAddress).mem.insertMeta({
              type: 'dhtMeta',
              providerAgentId: opt.data.providerAgentId,
              entryAddress: opt.data.entryAddress,
              attribute: opt.data.attribute,
              content: opt.data.content
            })
            return
          }
          // Send back to requester
          ref = this._getMemRef(opt.data.dnaAddress)
          if (!(opt.data.requesterAgentId in ref.agentToTransportId)) {
            this._ipc.send('json', {
              method: 'failureResult',
              _id: opt.data._id,
              dnaAddress: opt.data.dnaAddress,
              toAgentId: opt.data.requesterAgentId,
              errorInfo: 'No routing for agent id "' + opt.data.requesterAgentId + '" aborting handleFetchMetaResult'
            })
            return
          }
          tId = ref.agentToTransportId[opt.data.requesterAgentId]
          this._p2pSend(tId, {
            type: 'fetchMetaResult',
            _id: opt.data._id,
            dnaAddress: opt.data.dnaAddress,
            requesterAgentId: opt.data.requesterAgentId,
            providerAgentId: opt.data.providerAgentId,
            agentId: opt.data.agentId,
            entryAddress: opt.data.entryAddress,
            attribute: opt.data.attribute,
            content: opt.data.content
          })
          return
        case 'handleGetPublishingEntryListResult':
          // Note: opt.data is EntryListData
          // Mark my request as resolved and get bucketId from request
          bucketId = this._checkRequest(opt.data._id)
          if (bucketId === '') {
            return
          }
          // get already known publishing list
          let knownPublishingList = {}
          if (bucketId in this._publishedEntryBook) {
            knownPublishingList = this._publishedEntryBook[bucketId]
          }

          // Update my book-keeping on what this agent has.
          // and do a getEntry for every new entry
          for (const entryAddress of opt.data.entryAddressList) {
            if (entryAddress in knownPublishingList) {
              log.t('Entry is known ', entryAddress)
              continue
            }
            let fetchEntry = {
              method: 'handleFetchEntry',
              dnaAddress: opt.data.dnaAddress,
              _id: this._createRequestWithBucket(bucketId),
              requesterAgentId: '',
              address: entryAddress
            }
            this._ipc.send('json', fetchEntry)
          }
          return

        case 'handleGetHoldingEntryListResult':
          // Note: opt.data is EntryListData
          // Mark my request as resolved and get bucketId from request
          bucketId = this._checkRequest(opt.data._id)
          if (bucketId === '') {
            return
          }
          // get already known publishing list
          let knownHoldingList = {}
          if (bucketId in this._storedEntryBook) {
            knownHoldingList = this._storedEntryBook[bucketId]
          }
          // Update my book-keeping on what this agent has.
          // and do a getEntry for every new entry
          for (const entryAddress of opt.data.entryAddressList) {
            if (entryAddress in knownHoldingList) {
              continue
            }
            let fetchEntry = {
              method: 'handleFetchEntry',
              dnaAddress: opt.data.dnaAddress,
              _id: this._createRequestWithBucket(bucketId),
              requesterAgentId: '',
              address: entryAddress
            }
            this._ipc.send('json', fetchEntry)
          }
          return

        case 'handleGetPublishingMetaListResult':
          // Note: opt.data is MetaListData
          // Mark my request as resolved and get bucketId from request
          bucketId = this._checkRequest(opt.data._id)
          if (bucketId === '') {
            return
          }

          // get already known publishing list
          let knownPublishingMetaList = {}
          if (bucketId in this._publishedMetaBook) {
            knownPublishingMetaList = this._publishedMetaBook[bucketId]
          }

          // Update my book-keeping on what this agent has.
          // and do a getEntry for every new entry
          for (const metaPair of opt.data.metaList) {
            let metaId = this._catEntryAttribute(metaPair[0], metaPair[1])
            if (metaId in knownPublishingMetaList) {
              continue
            }
            let fetchMeta = {
              method: 'handleFetchMeta',
              dnaAddress: opt.data.dnaAddress,
              _id: this._createRequestWithBucket(bucketId),
              requesterAgentId: '',
              entryAddress: metaPair[0],
              attribute: metaPair[1]
            }
            this._ipc.send('json', fetchMeta)
          }
          return

        case 'handleGetHoldingMetaListResult':
          // Note: opt.data is MetaListData
          // Mark my request as resolved and get bucketId from request
          bucketId = this._checkRequest(opt.data._id)
          if (bucketId === '') {
            return
          }
          // get already known publishing list
          let knownHoldingMetaList = {}
          if (bucketId in this._storedMetaBook) {
            knownHoldingMetaList = this._storedMetaBook[bucketId]
          }
          // Update my book-keeping on what this agent has.
          // and do a getEntry for every new entry
          // for (let entryAddress in opt.data.metaList) {
          for (const metaPair of opt.data.metaList) {
            let metaId = this._catEntryAttribute(metaPair[0], metaPair[1])
            if (metaId in knownHoldingMetaList) {
              continue
            }
            let fetchMeta = {
              method: 'handleFetchMeta',
              dnaAddress: opt.data.dnaAddress,
              _id: this._createRequestWithBucket(bucketId),
              requesterAgentId: '',
              entryAddress: metaPair[0],
              attribute: metaPair[1]
            }
            this._ipc.send('json', fetchMeta)
          }
          return
      }
    }

    throw new Error('unexpected input ' + JSON.stringify(opt))
  }

  _handleP2pEvent (evt) {
    switch (evt.type) {
      case 'peerConnect':
        this._peerBookInsert(evt.peerAddress)
        break
      case 'handlePublish':
        this._handleP2pMessage({
          from: evt.fromPeerAddress,
          data: msgpack.decode(Buffer.from(evt.data, 'base64'))
        })
        break
      default:
        throw new Error('unexpected event type: ' + evt.type)
    }
  }

  /**
   * Received a message from the network.
   * Might send some messages back and
   * transcribe received message into a local IPC message.
   */
  _handleP2pMessage (opt) {
    // log.w('@@@@', opt.data.type, JSON.stringify(opt.data))
    switch (opt.data.type) {
      case 'gossipHashHash':
        // send back a gossipRequestLocHashes and a gossipHashHashResp
        this._processGossipHashHash(opt.from, opt.data.gossipHashHash)
        const gossipHashHash = this._fullGossipHashHash()
        // log.t('gossip (resp) with', opt.from, JSON.stringify(gossipHashHash))
        this._p2pSend(opt.from, {
          type: 'gossipHashHashResp',
          gossipHashHash
        })
        return
      case 'gossipHashHashResp':
        // send back a gossipRequestLocHashes
        this._processGossipHashHash(opt.from, opt.data.gossipHashHash)
        return
      case 'gossipRequestLocHashes':
        // send back a gossipHashList
        this._processRequestLocHashes(opt.from, opt.data.locList)
        return
      case 'gossipHashList':
        // send back many getData
        this._processGossipHashList(opt.from, opt.data.hashList)
        return
      case 'getData':
        // send back a getDataResp
        this._processGetData(opt.from, opt.data.dnaAddress, opt.data.hash)
        return
      case 'getDataResp':
        // store the data received
        this._processGetDataResp(opt.data.dnaAddress, opt.data.data)
        return
      case 'handleSendMessage':
        // transcribe to IPC
        this._ipc.send('json', {
          method: 'handleSendMessage',
          _id: opt.data._id,
          dnaAddress: opt.data.dnaAddress,
          toAgentId: opt.data.toAgentId,
          fromAgentId: opt.data.fromAgentId,
          data: opt.data.data
        })
        return
      case 'sendMessageResult':
        // transcribe to IPC
        this._ipc.send('json', {
          method: 'sendMessageResult',
          _id: opt.data._id,
          dnaAddress: opt.data.dnaAddress,
          toAgentId: opt.data.toAgentId,
          fromAgentId: opt.data.fromAgentId,
          data: opt.data.data
        })
        return
      case 'fetchEntryResult':
        // transcribe to IPC
        this._ipc.send('json', {
          method: 'fetchEntryResult',
          _id: opt.data._id,
          dnaAddress: opt.data.dnaAddress,
          requesterAgentId: opt.data.requesterAgentId,
          providerAgentId: opt.data.providerAgentId,
          agentId: opt.data.agentId,
          address: opt.data.address,
          content: opt.data.content
        })
        return
      case 'fetchMetaResult':
        // transcribe to IPC
        this._ipc.send('json', {
          method: 'fetchMetaResult',
          _id: opt.data._id,
          dnaAddress: opt.data.dnaAddress,
          requesterAgentId: opt.data.requesterAgentId,
          providerAgentId: opt.data.providerAgentId,
          agentId: opt.data.agentId,
          entryAddress: opt.data.entryAddress,
          attribute: opt.data.attribute,
          content: opt.data.content
        })
        return
      case 'failureResult':
        // transcribe to IPC
        this._ipc.send('json', {
          method: 'failureResult',
          _id: opt.data._id,
          dnaAddress: opt.data.dnaAddress,
          toAgentId: opt.data.toAgentId,
          errorInfo: opt.data.errorInfo
        })
        return
    }

    throw new Error('unexpected p2p message ' + opt.from + ' ' + JSON.stringify(
      opt.data))
  }

  /**
   *   Received a 'gossipHashHash'
   *   Send back a 'gossipRequestLocHashes'
   */
  _processGossipHashHash (fromId, gossipHashHash) {
    // we got a gossip response! push back next step 2 seconds
    this._pauseGossip(null, 2000)

    const locList = []
    for (let hh of gossipHashHash) {
      if (hh.dnaAddress in this._memory) {
        const ref = this._memory[hh.dnaAddress].mem
        const ll = ref.getGossipLocListForGossipHashHash(hh.gossipHashHash)
        if (ll.length > 0) {
          locList.push({
            dnaAddress: hh.dnaAddress,
            locList: ll
          })
        }
      }
    }

    if (locList.length < 1) {
      return
    }

    this._p2pSend(fromId, {
      type: 'gossipRequestLocHashes',
      locList
    })
  }

  /// send back a gossipHashList: all the hashes that we 'stored' in every loc given in locList
  _processRequestLocHashes (fromId, locList) {
    // log.t('requestLocHashes', fromId, JSON.stringify(locList))

    // we got a gossip response! push back next step 2 seconds
    this._pauseGossip(null, 2000)

    const hashList = []
    for (let ll of locList) {
      if (ll.dnaAddress in this._memory) {
        const ref = this._memory[ll.dnaAddress].mem
        const hl = ref.getGossipHashesForGossipLocList(ll.locList)
        if (hl.length > 0) {
          hashList.push({
            dnaAddress: ll.dnaAddress,
            hashList: hl
          })
        }
      }
    }

    this._p2pSend(fromId, {
      type: 'gossipHashList',
      hashList
    })
  }

  /// send back a getData per hash in list
  _processGossipHashList (fromId, hashList) {
    // log.t('hashList', fromId, JSON.stringify(hashList))

    // we got a gossip response! push back next step 2 seconds
    this._pauseGossip(null, 2000)

    for (let hl of hashList) {
      if (hl.dnaAddress in this._memory) {
        for (let hash of hl.hashList) {
          this._p2pSend(fromId, {
            type: 'getData',
            dnaAddress: hl.dnaAddress,
            hash
          })
        }
      }
    }
  }

  /**
   * send back a getDataResp
   */
  _processGetData (fromId, dnaAddress, hash) {
    // log.t('getData', fromId, dnaAddress, hash)
    if (dnaAddress in this._memory) {
      const ref = this._memory[dnaAddress].mem
      if (ref.has(hash)) {
        const data = ref.get(hash)
        this._p2pSend(fromId, {
          type: 'getDataResp',
          dnaAddress: dnaAddress,
          data
        })
      }
    }
  }

  /**
   * Received GetDataResp back from our request: store the data received
   */
  _processGetDataResp (dnaAddress, data) {
    if (dnaAddress in this._memory) {
      const ref = this._memory[dnaAddress].mem
      if (data.entry && data.entry.address && data.entry.address.length) {
        if (ref.insert(data.entry)) {
          log.t('newGossipEntry', dnaAddress, JSON.stringify(data.entry))
        }
      }
      for (let meta of data.meta) {
        if (ref.insertMeta(meta)) {
          log.t('newGossipMeta', dnaAddress, meta.address, JSON.stringify(meta))
        }
      }
    }
  }

  _getMemRef (dnaAddress) {
    if (!(dnaAddress in this._memory)) {
      const mem = new Mem()
      // send IPC handleStoreEntry on inserting a dhtEntry
      mem.registerIndexer((store, data) => {
        if (data && data.type === 'dhtEntry') {
          log.t('got dhtEntry', data)
          this._bookkeepAddress(this._storedEntryBook, dnaAddress, data.address)
          this._ipc.send('json', {
            method: 'handleStoreEntry',
            dnaAddress,
            providerAgentId: data.providerAgentId,
            address: data.address,
            content: data.content
          })
        }
      })
      // send IPC handleStoreMeta on inserting a dhtMeta
      mem.registerIndexer((store, data) => {
        if (data && data.type === 'dhtMeta') {
          log.t('got dhtMeta', data)
          const metaId = this._catEntryAttribute(data.entryAddress, data.attribute)
          this._bookkeepAddress(this._storedMetaBook, dnaAddress, metaId)
          this._ipc.send('json', {
            method: 'handleStoreMeta',
            dnaAddress,
            providerAgentId: data.providerAgentId,
            entryAddress: data.entryAddress,
            attribute: data.attribute,
            content: data.content
          })
        }
      })
      // send IPC peerConnected on inserting an 'agent'
      this._memory[dnaAddress] = {
        mem,
        agentToTransportId: mem.registerIndexer((store, data) => {
          if (data && data.type === 'agent') {
            log.t('got peer', data)
            store[data.agentId] = data.transportId
            this._ipc.send('json', {
              method: 'peerConnected',
              agentId: data.agentId
            })
          }
        })
      }
    }
    return this._memory[dnaAddress]
  }

  _checkRequest (requestId) {
    if (!this._requestBook.has(requestId)) {
      return ''
    }
    let bucketId = this._requestBook.get(requestId)
    this._requestBook.delete(requestId)
    return bucketId
  }

  _track (dnaAddress, agentId) {
    const ref = this._getMemRef(dnaAddress)
    // store agent (this will map agentId to transportId)
    ref.mem.insert({
      type: 'agent',
      dnaAddress: dnaAddress,
      agentId: agentId,
      address: agentId,
      transportId: this._p2p.getId()
    })

    // send get lists
    let requestId = this._createRequest(dnaAddress, agentId)
    this._ipc.send('json', {
      method: 'handleGetPublishingEntryList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipc.send('json', {
      method: 'handleGetHoldingEntryList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipc.send('json', {
      method: 'handleGetPublishingMetaList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipc.send('json', {
      method: 'handleGetHoldingMetaList',
      dnaAddress,
      _id: requestId
    })
  }

  _catDnaAgent (DnaHash, AgentId) {
    return '' + DnaHash + '::' + AgentId
  }

  /**
   *   Make a metaId out of an entryAddress and an attribute
   */
  _catEntryAttribute (entryAddress, attribute) {
    return '' + entryAddress + '||' + attribute
  }

  _generateRequestId () {
    this._requestCount += 1
    return 'req_' + this._requestCount
  }

  /**
   *  create and return a new request_id
   */
  _createRequest (dnaAddress, agentId) {
    let bucketId = this._catDnaAgent(dnaAddress, agentId)
    return this._createRequestWithBucket(bucketId)
  }

  _createRequestWithBucket (bucketId) {
    let reqId = this._generateRequestId()
    this._requestBook.set(reqId, bucketId)
    return reqId
  }

  _bookkeepAddress (book, dnaAddress, address) {
    if (!(dnaAddress in book)) {
      book[dnaAddress] = []
    }
    book[dnaAddress].push(address)
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

  /**
   * gossip tick: ask all hashes from next peer (send a p2p gossipHashHash)
   */
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

    // get next peer
    const thisGossipPeer = Object.keys(this._peerBook)[gs.lastPeerIndex++]
    const peerRef = this._peerBook[thisGossipPeer]
    if (Date.now() - peerRef.lastGossip < 1000) {
      this._pauseGossip('peer too recent, pauing gossip for .5 seconds', 500)
      return
    }
    peerRef.lastGossip = Date.now()

    // build gossip: Request all hashes per DNA
    const gossipHashHash = this._fullGossipHashHash()

    // log.t('gossip with', thisGossipPeer, JSON.stringify(gossipHashHash))

    this._p2pSend(thisGossipPeer, {
      type: 'gossipHashHash',
      gossipHashHash
    })
  }

  /**
   *  return an array of gossipHashHash (one per dna) to gossip
   */
  _fullGossipHashHash () {
    const out = []
    for (let dnaAddress in this._memory) {
      out.push({
        dnaAddress,
        gossipHashHash: this._memory[dnaAddress].mem.getGossipHashHash()
      })
    }
    return out
  }
}

exports.N3hHackMode = N3hHackMode
