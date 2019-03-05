const msgpack = require('msgpack-lite')

const { P2p } = require('../n3h-mod-spec')
const { P2pBackendHackmodePeer } = require('./p2p-backend-hackmode-peer')

const { N3hMode } = require('../n3h-ipc/n3hMode')

const { Mem, getHash } = require('./mem')

const tweetlog = require('../tweetlog')
const log = tweetlog('@hackmode@')

/**
 * N3h "hackmode" prototyping code
 *
 * Expects a config either over stdin or as a file `n3h-config.json` in the
 * working directory.
 * If neither is supplied, will load up the following default:
 *
 * ```
 * "webproxy": {
 *   "connection": {
 *     "rsaBits": 1024,
 *     "bind": [
 *       "wss://0.0.0.0:0/"
 *     ]
 *   },
 *   "wssAdvertise": "auto",
 *   "wssRelayPeers": null
 * }
 * ```
 *
 * Config Definitions:
 *
 * - `webproxy.connection.rsaBits` {number} - rsa bits to use for tls on websocket server
 * - `webproxy.connection.bind` {array<uri>} - uri array of NICs to bind the websocket server. use host `0.0.0.0` for "all" NICs, use port `0` for random (os-assigned) port. You can specify a path, e.g. `"wss://127.0.0.1:8443/test/path/"`
 * - `webproxy.wssAdvertise` {uri|"auto"} - Cannot be paired with `wssRelayPeers`. Sets up this node to be directly connectable at this address. Special case if set to `"auto"` will pick the first public NIC binding... allowing for os-assigned ports.
 * - `webproxy.wssRelayPeers` {array<uri>} - Cannot be paired with `wssAdvertise`. Uri array of relay peers to connect through. (currently you can only specify 1). Use this if behind a NAT, all messages will be routed through the peer specified here.
 */
class N3hHackMode extends N3hMode {
  async init (workDir, rawConfigData) {
    await super.init()

    this._peerBook = {}
    this._requestBook = new Map()

    this._gossipState = {
      lastPeerIndex: 0,
      pauseUntil: 0
    }

    await Promise.all([
      this._initP2p()
    ])

    // make sure this is output despite our log settings
    console.log('#P2P-BINDING#:' + this._p2p.getAdvertise())
    console.log('#P2P-READY#')

    this._gossipTimer = setInterval(() => this._checkGossip(), 200)
  }

  // -- private -- //

  /**
   * @private
   */
  async _initP2p () {
    const p2pConf = {
      dht: {},
      connection: {
        // TODO - allow some kind of environment var?? for setting passphrase
        passphrase: 'hello',
        rsaBits: this._config.webproxy.connection.rsaBits,
        bind: this._config.webproxy.connection.bind
      }
    }

    if (this._config.webproxy.wssRelayPeers) {
      p2pConf.wssRelayPeers = this._config.webproxy.wssRelayPeers
    } else {
      p2pConf.wssAdvertise = this._config.webproxy.wssAdvertise
    }

    this._p2p = await new P2p(P2pBackendHackmodePeer, p2pConf)

    this._p2p.on('event', evt => this._handleP2pEvent(evt))

    const advertise = this._p2p.getAdvertise()
    log.i('p2p bound', advertise)
  }

  /**
   * @private
   */
  async _p2pSend (peerAddress, obj) {
    return this._p2p.publishReliable(
      [peerAddress],
      msgpack.encode(obj).toString('base64')
    )
  }

  /**
   * @private
   */
  _peerBookInsert (id) {
    if (!(id in this._peerBook)) {
      this._peerBook[id] = {
        lastGossip: 0
      }
    }
  }

  /**
   * @private
   */
  _handleIpcJson (data, senderId) {
    log.t('Received IPC: ', data)

    let ref
    let tId
    let bucketId
    switch (data.method) {
      case 'failureResult':
        // Note: data is a FailureResultData
        // Check if its a response to our own request
        bucketId = this._checkRequest(data._id)
        if (bucketId !== '') {
          return
        }
        // if not relay to receipient if possible
        tId = this._getTransportIdOrFail(data.dnaAddress, data.toAgentId)
        if (tId === null) {
          return
        }
        this._p2pSend(tId, {
          type: 'failureResult',
          dnaAddress: data.dnaAddress,
          _id: data._id,
          toAgentId: data.toAgentId,
          errorInfo: data.errorInfo
        })
        return
      case 'requestState':
        this._ipcSend('json', {
          method: 'state',
          state: 'ready',
          id: this._p2p.getId(),
          bindings: [this._p2p.getAdvertise()]
        })
        return
      case 'connect':
        this._p2p.transportConnect(data.address).then(() => {
          log.t('connected', data.address)
        }, (err) => {
          log.e('connect (' + data.address + ') failed', err.toString())
        })
        return
      case 'trackDna':
        // Note: data is a TrackDnaData
        this._track(data.dnaAddress, data.agentId)
        return
      case 'untrackDna':
        // Note: data is a TrackDnaData
        this._untrack(data.dnaAddress, data.agentId)
        return
      case 'sendMessage':
        // Note: data is a MessageData
        // Sender must TrackDna
        if (!this._hasTrackOrFail(data.fromAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Receiver must TrackDna
        tId = this._getTransportIdOrFail(data.dnaAddress, data.toAgentId, data.fromAgentId, data._id)
        if (tId === null) {
          return
        }
        this._p2pSend(tId, {
          type: 'handleSendMessage',
          _id: data._id,
          dnaAddress: data.dnaAddress,
          toAgentId: data.toAgentId,
          fromAgentId: data.fromAgentId,
          data: data.data
        })
        return
      case 'handleSendMessageResult':
        // Note: data is a MessageData
        // Sender must TrackDna
        if (!this._hasTrackOrFail(data.fromAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Receiver must TrackDna
        tId = this._getTransportIdOrFail(data.dnaAddress, data.toAgentId, data.fromAgentId, data._id)
        if (tId === null) {
          return
        }
        this._p2pSend(tId, {
          type: 'sendMessageResult',
          _id: data._id,
          dnaAddress: data.dnaAddress,
          toAgentId: data.toAgentId,
          fromAgentId: data.fromAgentId,
          data: data.data
        })
        return
      case 'publishEntry':
        // Note: data is a EntryData
        if (!this._hasTrackOrFail(data.providerAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Bookkeep
        this._bookkeepAddress(this._publishedEntryBook, data.dnaAddress, data.address)
        // publish
        this._getMemRef(data.dnaAddress).mem.insert({
          type: 'dhtEntry',
          providerAgentId: data.providerAgentId,
          address: data.address,
          content: data.content
        })
        return
      case 'publishMeta':
        // Note: data is a DhtMetaData
        if (!this._hasTrackOrFail(data.providerAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Bookkeep each metaId
        for (const metaContent of data.contentList) {
          let metaId = this._metaIdFromTuple(data.entryAddress, data.attribute, metaContent)
          this._bookkeepAddress(this._publishedMetaBook, data.dnaAddress, metaId)
        }
        // publish
        log.t('publishMeta', data.contentList)
        this._getMemRef(data.dnaAddress).mem.insertMeta({
          type: 'dhtMeta',
          providerAgentId: data.providerAgentId,
          entryAddress: data.entryAddress,
          attribute: data.attribute,
          contentList: data.contentList
        })
        return
      case 'fetchEntry':
        // Note: data is a FetchEntryData
        if (!this._hasTrackOrFail(data.requesterAgentId, data.dnaAddress, data._id)) {
          return
        }
        //  since we're fully connected, just redirect this back to itself for now...
        data.method = 'handleFetchEntry'
        this._ipcSend('json', data)
        return
      case 'handleFetchEntryResult':
        // Note: data is a FetchEntryResultData
        // Local node should be tracking DNA
        if (!this._hasTrackOrFail(data.providerAgentId, data.dnaAddress, data._id)) {
          return
        }
        // if this message is a response from our own request, do a publish
        bucketId = this._checkRequest(data._id)
        if (bucketId !== '') {
          const isPublish = data.providerAgentId === '__publish'
          this._bookkeepAddress(isPublish ? this._publishedEntryBook : this._storedEntryBook, data.dnaAddress, data.address)
          this._getMemRef(data.dnaAddress).mem.insert({
            type: 'dhtEntry',
            providerAgentId: data.providerAgentId,
            address: data.address,
            content: data.content
          })
          return
        }
        // Requester must TrackDna
        tId = this._getTransportIdOrFail(data.dnaAddress, data.requesterAgentId, data.providerAgentId, data._id)
        if (tId === null) {
          return
        }
        this._p2pSend(tId, {
          type: 'fetchEntryResult',
          _id: data._id,
          dnaAddress: data.dnaAddress,
          requesterAgentId: data.requesterAgentId,
          providerAgentId: data.providerAgentId,
          agentId: data.agentId,
          address: data.address,
          content: data.content
        })
        return
      case 'fetchMeta':
        // Note: data is a FetchMetaData
        if (!this._hasTrackOrFail(data.requesterAgentId, data.dnaAddress, data._id)) {
          return
        }
        // erm... since we're fully connected,
        // just redirect this back to itself for now...
        data.method = 'handleFetchMeta'
        this._ipcSend('json', data)
        return
      case 'handleFetchMetaResult':
        // Note: data is a FetchMetaResultData
        // Local node should be tracking DNA
        if (!this._hasTrackOrFail(data.providerAgentId, data.dnaAddress, data._id)) {
          return
        }
        ref = this._getMemRef(data.dnaAddress)
        // if its from our own request, do a publish for each new/unknown meta content
        bucketId = this._checkRequest(data._id)
        if (bucketId !== '') {
          const isPublish = data.providerAgentId === '__publish'
          // get already known list
          let knownMetaList = []
          if (isPublish) {
            if (bucketId in this._publishedMetaBook) {
              knownMetaList = this._publishedMetaBook[bucketId]
            }
          } else {
            if (bucketId in this._storedMetaBook) {
              knownMetaList = this._storedMetaBook[bucketId]
            }
          }
          for (const metaContent of data.contentList) {
            let metaId = this._metaIdFromTuple(data.entryAddress, data.attribute, metaContent)
            if (knownMetaList.includes(metaId)) {
              continue
            }
            this._bookkeepAddress(isPublish ? this._publishedMetaBook : this._storedMetaBook, data.dnaAddress, metaId)
            log.t('handleFetchMetaResult insert:', metaContent, data.providerAgentId, metaId, isPublish)
            ref.mem.insertMeta({
              type: 'dhtMeta',
              providerAgentId: data.providerAgentId,
              entryAddress: data.entryAddress,
              attribute: data.attribute,
              contentList: [metaContent]
            })
          }
          return
        }
        // Requester must TrackDna
        tId = this._getTransportIdOrFail(data.dnaAddress, data.requesterAgentId, data.providerAgentId, data._id)
        if (tId === null) {
          return
        }
        this._p2pSend(tId, {
          type: 'fetchMetaResult',
          _id: data._id,
          dnaAddress: data.dnaAddress,
          requesterAgentId: data.requesterAgentId,
          providerAgentId: data.providerAgentId,
          agentId: data.agentId,
          entryAddress: data.entryAddress,
          attribute: data.attribute,
          contentList: data.contentList
        })
        return
      case 'handleGetPublishingEntryListResult':
        // Note: data is EntryListData
        // Mark my request as resolved and get bucketId from request
        bucketId = this._checkRequest(data._id)
        if (bucketId === '') {
          return
        }
        // get already known publishing list
        let knownPublishingList = []
        if (bucketId in this._publishedEntryBook) {
          knownPublishingList = this._publishedEntryBook[bucketId]
        }

        // Update my book-keeping on what this agent has.
        // and do a getEntry for every new entry
        for (const entryAddress of data.entryAddressList) {
          if (knownPublishingList.includes(entryAddress)) {
            log.t('Entry is known ', entryAddress)
            continue
          }
          let fetchEntry = {
            method: 'handleFetchEntry',
            dnaAddress: data.dnaAddress,
            _id: this._createRequestWithBucket(bucketId),
            requesterAgentId: '__publish',
            address: entryAddress
          }
          log.t('Sending IPC:', fetchEntry)
          this._ipcSend('json', fetchEntry)
        }
        return

      case 'handleGetHoldingEntryListResult':
        // Note: data is EntryListData
        // Mark my request as resolved and get bucketId from request
        bucketId = this._checkRequest(data._id)
        if (bucketId === '') {
          return
        }
        // get already known publishing list
        let knownHoldingList = []
        if (bucketId in this._storedEntryBook) {
          knownHoldingList = this._storedEntryBook[bucketId]
        }
        // Update my book-keeping on what this agent has.
        // and do a getEntry for every new entry
        for (const entryAddress of data.entryAddressList) {
          if (knownHoldingList.includes(entryAddress)) {
            continue
          }
          let fetchEntry = {
            method: 'handleFetchEntry',
            dnaAddress: data.dnaAddress,
            _id: this._createRequestWithBucket(bucketId),
            requesterAgentId: '__hold',
            address: entryAddress
          }
          log.t('Sending IPC:', fetchEntry)
          this._ipcSend('json', fetchEntry)
        }
        return

      case 'handleGetPublishingMetaListResult':
        // Note: data is MetaListData
        // Mark my request as resolved and get bucketId from request
        bucketId = this._checkRequest(data._id)
        if (bucketId === '') {
          return
        }

        // get already known publishing list
        let knownPublishingMetaList = []
        if (bucketId in this._publishedMetaBook) {
          knownPublishingMetaList = this._publishedMetaBook[bucketId]
        }

        // Update my book-keeping on what this agent has.
        // and do a getEntry for every new entry
        let requestedMetaKey = []
        for (const metaTuple of data.metaList) {
          let metaId = this._metaIdFromTuple(metaTuple[0], metaTuple[1], metaTuple[2])
          if (knownPublishingMetaList.includes(metaId)) {
            continue
          }
          log.t('handleGetPublishingMetaListResult, unknown metaId = ', metaId)
          // dont send same request twice
          const metaKey = '' + metaTuple[0] + '+' + metaTuple[1]
          if (requestedMetaKey.includes(metaKey)) {
            continue
          }
          requestedMetaKey.push(metaKey)
          let fetchMeta = {
            method: 'handleFetchMeta',
            dnaAddress: data.dnaAddress,
            _id: this._createRequestWithBucket(bucketId),
            requesterAgentId: '__publish',
            entryAddress: metaTuple[0],
            attribute: metaTuple[1]
          }
          log.t('Sending IPC:', fetchMeta)
          this._ipcSend('json', fetchMeta)
        }
        return

      case 'handleGetHoldingMetaListResult':
        // Note: data is MetaListData
        // Mark my request as resolved and get bucketId from request
        bucketId = this._checkRequest(data._id)
        if (bucketId === '') {
          return
        }
        // get already known publishing list
        let knownHoldingMetaList = []
        if (bucketId in this._storedMetaBook) {
          knownHoldingMetaList = this._storedMetaBook[bucketId]
        }
        // Update my book-keeping on what this agent has.
        // and do a getEntry for every new entry
        // for (let entryAddress in data.metaList) {
        for (const metaTuple of data.metaList) {
          let metaId = this._metaIdFromTuple(metaTuple[0], metaTuple[1], metaTuple[2])
          if (knownHoldingMetaList.includes(metaId)) {
            continue
          }
          let fetchMeta = {
            method: 'handleFetchMeta',
            dnaAddress: data.dnaAddress,
            _id: this._createRequestWithBucket(bucketId),
            requesterAgentId: '__hold',
            entryAddress: metaTuple[0],
            attribute: metaTuple[1]
          }
          log.t('Sending IPC:', fetchMeta)
          this._ipcSend('json', fetchMeta)
        }
        return
    }

    throw new Error('unexpected input ' + JSON.stringify(data))
  }

  /**
   * @private
   */
  _checkRequest (requestId) {
    if (!this._requestBook.has(requestId)) {
      return ''
    }
    let bucketId = this._requestBook.get(requestId)
    this._requestBook.delete(requestId)
    return bucketId
  }

  /**
   * @private
   */
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
   * @private
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
        log.t('Received P2P handleSendMessage', opt.data)

        // Send error back to sender if we untracked this DNA
        if (!this._ipcHasTrack(opt.data.toAgentId, opt.data.dnaAddress)) {
          log.e('#### P2P hasTrack() failed for agent "' + opt.data.toAgentId + '" ; DNA = "' + opt.data.dnaAddress + '"')
          const tId = this._getTransportIdOrFail(opt.data.dnaAddress, opt.data.fromAgentId)
          if (tId === null) {
            return
          }
          this._p2pSend(tId, {
            type: 'failureResult',
            dnaAddress: opt.data.dnaAddress,
            _id: opt.data._id,
            toAgentId: opt.data.fromAgentId,
            errorInfo: 'Agent "' + opt.data.toAgentId + '" is not tracking DNA' + opt.data.dnaAddress
          })
          return
        }

        // transcribe to IPC
        this._ipcSend('json', {
          method: 'handleSendMessage',
          _id: opt.data._id,
          dnaAddress: opt.data.dnaAddress,
          toAgentId: opt.data.toAgentId,
          fromAgentId: opt.data.fromAgentId,
          data: opt.data.data
        })
        return
      case 'sendMessageResult':
        log.t('Received P2P sendMessageResult', opt.data)

        // transcribe to IPC
        this._ipcSend('json', {
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
        this._ipcSend('json', {
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
        this._ipcSend('json', {
          method: 'fetchMetaResult',
          _id: opt.data._id,
          dnaAddress: opt.data.dnaAddress,
          requesterAgentId: opt.data.requesterAgentId,
          providerAgentId: opt.data.providerAgentId,
          agentId: opt.data.agentId,
          entryAddress: opt.data.entryAddress,
          attribute: opt.data.attribute,
          contentList: opt.data.contentList
        })
        return
      case 'failureResult':
        // transcribe to IPC
        this._ipcSend('json', {
          method: 'failureResult',
          _id: opt.data._id,
          dnaAddress: opt.data.dnaAddress,
          toAgentId: opt.data.toAgentId,
          errorInfo: opt.data.errorInfo
        })
        return
    }

    throw new Error('Received unexpected p2p message ' + opt.from + ' ' + JSON.stringify(
      opt.data))
  }

  /**
   *   Received a 'gossipHashHash'
   *   Send back a 'gossipRequestLocHashes'
   * @private
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

  /**
   * send back a gossipHashList: all the hashes that we 'stored' in every loc given in locList
   * @private
   */
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

  /**
   * send back a getData per hash in list
   * @private
   */
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
   * @private
   */
  _processGetData (fromId, dnaAddress, hash) {
    // log.t('getData', fromId, dnaAddress, hash)
    if (dnaAddress in this._memory) {
      const ref = this._memory[dnaAddress].mem
      if (ref.has(hash)) {
        const data = ref.get(hash)
        log.t('sending gossip data', data)
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
   * @private
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

  /**
   * @private
   */
  _getMemRef (dnaAddress) {
    if (!(dnaAddress in this._memory)) {
      const mem = new Mem()
      // send IPC handleStoreEntry on inserting a dhtEntry
      mem.registerIndexer((store, data) => {
        if (data && data.type === 'dhtEntry') {
          if (this._hasEntry(dnaAddress, data.address)) {
            log.t('dhtEntry is known:', data.address)
            return
          }
          log.t('got dhtEntry', data)
          this._bookkeepAddress(this._storedEntryBook, dnaAddress, data.address)
          log.t('Sending IPC handleStoreEntry: ', data.address)
          this._ipcSend('json', {
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
          let toStoreList = []
          for (const metaContent of data.contentList) {
            const metaId = this._metaIdFromTuple(data.entryAddress, data.attribute, metaContent)
            if (this._hasMeta(dnaAddress, metaId)) {
              log.t('metaContent is known:', metaContent)
              continue
            }
            this._bookkeepAddress(this._storedMetaBook, dnaAddress, metaId)
            toStoreList.push(metaContent)
          }
          log.t('Sending IPC handleStoreMeta: ', toStoreList)
          this._ipcSend('json', {
            method: 'handleStoreMeta',
            dnaAddress,
            providerAgentId: data.providerAgentId,
            entryAddress: data.entryAddress,
            attribute: data.attribute,
            contentList: toStoreList
          })
        }
      })
      // send IPC peerConnected on inserting an 'agent'
      this._memory[dnaAddress] = {
        mem,
        agentToTransportId: mem.registerIndexer((store, data) => {
          if (data && data.type === 'agent') {
            log.t('PEER INDEXED', data)
            store[data.agentId] = data.transportId
            this._ipcSend('json', {
              method: 'peerConnected',
              agentId: data.agentId
            })
          }
        })
      }
    }
    return this._memory[dnaAddress]
  }

  /**
   * We can't remove a mem entry but we can update it, so we update the transportId to undefined
   * to signify that this agent is no longer part of this DNA
   * @private
   */
  _untrack (dnaAddress, agentId) {
    log.t('_untrack() for "' + agentId + '" for DNA "' + dnaAddress + '"')
    this._ipcRemoveTrack(agentId, dnaAddress)
  }

  /**
   * @private
   */
  _track (dnaAddress, agentId) {
    log.t('REGISTER AGENT', dnaAddress, agentId)

    // Bookkeep tracking
    this._ipcAddTrack(agentId, dnaAddress)

    // Insert transportId in Mem
    const ref = this._getMemRef(dnaAddress)
    // store agent (this will map agentId to transportId)
    ref.mem.insert({
      type: 'agent',
      dnaAddress: dnaAddress,
      agentId: agentId,
      address: 'hackmode:peer:discovery:' + agentId,
      transportId: this._p2p.getId()
    })

    // send get lists
    let requestId = this._createRequest(dnaAddress, agentId)
    this._ipcSend('json', {
      method: 'handleGetPublishingEntryList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipcSend('json', {
      method: 'handleGetHoldingEntryList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipcSend('json', {
      method: 'handleGetPublishingMetaList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipcSend('json', {
      method: 'handleGetHoldingMetaList',
      dnaAddress,
      _id: requestId
    })
  }

  /**
   * Make a metaId out of an DhtMetaData
   * @private
   */
  _metaIdFromTuple (entryAddress, attribute, metaContentJson) {
    var metaContent = Buffer.from(JSON.stringify(metaContentJson))
    const hashedContent = getHash(metaContent)
    return '' + entryAddress + '||' + attribute + '||' + hashedContent
  }

  _generateRequestId () {
    this._requestCount += 1
    return 'req_' + this._requestCount
  }

  /**
   * create and return a new request_id
   * @private
   */
  _createRequest (dnaAddress, agentId) {
    // let bucketId = this._catDnaAgent(dnaAddress, agentId)
    return this._createRequestWithBucket(dnaAddress)
  }

  /**
   * @private
   */
  _createRequestWithBucket (bucketId) {
    let reqId = this._generateRequestId()
    this._requestBook.set(reqId, bucketId)
    return reqId
  }

  /**
   * @private
   */
  _bookkeepAddress (book, dnaAddress, address) {
    if (!(dnaAddress in book)) {
      book[dnaAddress] = []
    }
    book[dnaAddress].push(address)
  }

  /**
   * @private
   */
  _hasEntry (dnaAddress, entryAddress) {
    const isStored = dnaAddress in this._storedEntryBook
      ? this._storedEntryBook[dnaAddress].includes(entryAddress)
      : false
    return isStored
  }

  /**
   * @private
   */
  _hasMeta (dnaAddress, metaId) {
    const isStored = dnaAddress in this._storedMetaBook
      ? this._storedMetaBook[dnaAddress].includes(metaId)
      : false
    return isStored
  }

  /**
   * @private
   */
  _pauseGossip (msg, ms) {
    if (msg) {
      // log.i(msg)
    }
    const until = Date.now() + ms
    if (this._gossipState.pauseUntil < until) {
      this._gossipState.pauseUntil = until
    }
  }

  /**
   * @private
   */
  _checkGossip () {
    setImmediate(() => {
      if (this._gossipState.pauseUntil < Date.now()) {
        this._gossip()
      }
    })
  }

  /**
   * gossip tick: ask all hashes from next peer (send a p2p gossipHashHash)
   * @private
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
   * return an array of gossipHashHash (one per dna) to gossip
   * @private
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
