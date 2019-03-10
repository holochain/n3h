const msgpack = require('msgpack-lite')

const { P2p } = require('../n3h-mod-spec')
const { P2pBackendHackmodePeer } = require('./p2p-backend-hackmode-peer')

const { N3hMode } = require('../n3h-ipc/n3hMode')

const { Mem, getHash } = require('./mem')

const tweetlog = require('../tweetlog')
const log = tweetlog('@hackmode@')

const { DhtBackendFullsync, gossip } = require('../n3h-mod-dht-fullsync')

const { URL } = require('url')

// const gossip = require('./gossip')

const {
  Dht,
  DhtEvent
} = require('../n3h-mod-spec')

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

    this._requestBook = new Map()

    this._peerList = new Map()
    this._agent2peer = new Map()

    await Promise.all([
      this._initP2p()
    ])

    // make sure this is output despite our log settings
    console.log('#P2P-BINDING#:' + this._p2p.getAdvertise())
    console.log('#P2P-READY#')

    // Init Data DHT
    // (Not really used init options)
    const dhtInitOptions = { thisPeer: DhtEvent.peerHoldRequest(
      this._p2p.getId(), // '42',
      this._p2p.getTransport(), // null,
      Buffer.from('self').toString('base64'),
      Date.now())
    }
    this._dht = await new Dht(DhtBackendFullsync, dhtInitOptions)
    this._dht.on('event', e => this._handleDhtEvent(e).catch(err => {
      console.error('Handle Dht Event Error', e, err)
      process.exit(1)
    }))
  }

  // -- private -- //

  nick (peerId) {
    return '(' + peerId.substring(2, 6) + ')'
  }

  me () {
    return this.nick(this._p2p.getId())
  }

  /**
   * @private
   */
  async _initP2p () {
    // Create p2p config
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

    // Create P2p
    this._p2p = await new P2p(P2pBackendHackmodePeer, p2pConf)
    this._p2p.on('event', evt => this._handleP2pEvent(evt))

    // Done
    log.i('p2p bound', this._p2p.getAdvertise())
  }

  /**
   * @private
   */
  _handleIpcJson (data, senderId) {
    log.t('Received IPC: ', data)

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
        // Note: data.address must be an Advertise
        // Connect to Peer
        this._p2p.transportConnect(data.address).then(() => {
          log.t(this.me() + '.connected', data.address)


          // // Gossip back trackings
          // const uri = new URL(data.address)
          // if (!uri.searchParams.has('a')) {
          //   throw new Error('cannot connect to peer without nodeId ("a" param)')
          // }
          // const remotePeerId = uri.searchParams.get('a')
          //
          // const transport = uri.protocol + '//' + uri.hostname + ':' + uri.port
          // log.t('connected', transport)
          //
          // this._peerList[remotePeerId] = transport
          // // Gossip back my tracked DNA (and agents)
          // // log.t('(' + this._p2p.getId().substring(2, 6) + ').gossipTrack', this._ipcDnaByAgent.size)
          // this._p2pSend(remotePeerId, {
          //   type: 'gossipAllTracks',
          //   // advertise: this._p2p.getAdvertise(),
          //   dnaByAgent: Array.from(this._ipcDnaByAgent.keys())
          // })

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
        this._getMemRef(data.dnaAddress).insert({
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
        this._getMemRef(data.dnaAddress).insertMeta({
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
          this._getMemRef(data.dnaAddress).insert({
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
            this._getMemRef(data.dnaAddress).insertMeta({
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
   * Handler receiving Data DHT events (from other peers?)
   * @private
   */
  async _handleDhtEvent (e) {
    log.t('(' + this._p2p.getId().substring(2, 6) + ')._handleDhtEvent', e)
    // Handle event by type
    switch (e.type) {
      case 'peerHoldRequest':
        // Store Peer info in Data DHT as peer data
        this._dht.post(e)
        log.t('PEER INDEXED', e)
        // Notify my Core of connected Agent
        const agentId = Buffer.from(e.peerData, 'base64').toString('utf8')
        this._ipcSend('json', {
          method: 'peerConnected',
          agentId
        })
        break
      case 'gossipTo':
        // FIXME ?
        // const blist = msgpack.decode(Buffer.from(e.bundle, 'base64'))
        // const type = blist.shift()
        // const msgId = blist.shift()
        // const parsed = { type, msgId }
        // log.t('  bundleData = ', e.bundle)
        for (const peerId of e.peerList) {
          // const peerId = this._dht.getPeerLocal(agentId).peerData
          // log.t('  peerId =', this.nick(peerId))
          // this._p2pSendWithType(peerId, '$dhtGossip$', e.bundle)
          this._p2pSend(peerId, {
            type: 'dhtGossip', bundle: e.bundle
          })
        }
        break
      case 'dataHoldRequest':
        const data = JSON.parse(Buffer.from(e.data, 'base64'))
        log.t('  dataHoldRequest: ', data)
        if (data.type === 'dhtEntry') {
          this._getMemRef(data.dnaAddress).insert({
            type: 'dhtEntry',
            providerAgentId: data.providerAgentId,
            address: data.address,
            content: data.content
          })
        } else if (data.type === 'dhtMeta') {
          this._getMemRef(data.dnaAddress).insertMeta({
            type: 'dhtMeta',
            providerAgentId: data.providerAgentId,
            entryAddress: data.entryAddress,
            attribute: data.attribute,
            contentList: data.contentList
          })
        }
        // FIXME should post to self?
        // this._dht.post(e)
        break
      case 'dataFetch':
        // My dht asked me for all the data of an entry, give it a response
        let content = null
        // content = this._getMemRef(data.dnaAddress).get(evt.dataAddress)
        // content = JSON.stringify(content).toString('base64')
        this._dht.post(Dht.DhtEvent.dataFetchResponse(e.msgId, content))
        break
      default:
        throw new Error('unhandled dht event type ' + e.type + ' ' + JSON.stringify(e))
    }
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
   * Handler receiving an event from P2P module
   * @private
   */
  _handleP2pEvent (evt) {
    const me = this.me()
    log.t(me + '._handleP2pEvent()', evt.type)
    switch (evt.type) {
      case 'peerConnect':
        log.t(me + '.peerConnect', this.nick(evt.peerAddress), evt.peerTransport)
        // Bookkeep known peers
        this._peerList.set(evt.peerAddress, evt.peerTransport)
        // Gossip back my tracked DNA (and agents)
        // log.t(this.me() + '.gossipTrack', this._ipcDnaByAgent.size)
        this._p2pSend(evt.peerAddress, {
          type: 'gossipAllTracks',
          // advertise: this._p2p.getAdvertise(),
          dnaByAgent: Array.from(this._ipcDnaByAgent.keys())
        })
        break
      case 'handlePublish':
        // Handle message sent from _p2pSend()
        this._handleP2pPublish({
          from: evt.fromPeerAddress,
          data: msgpack.decode(Buffer.from(evt.data, 'base64'))
        })
        break
      default:
        throw new Error('unexpected event type: ' + evt.type)
    }
  }

  /**
   * Received a message from another node's _p2pSend()
   * Might send some messages back and
   * transcribe received message into a local IPC message.
   * @private
   */
  _handleP2pPublish (opt) {
    // log.t('@@@@', opt)
    let peerTransport
    log.t('@@' + this.me() + '@@ ', this.nick(opt.from), opt.data.type)
    switch (opt.data.type) {
      case 'dhtGossip':
        log.t(this.me() + ' received bundle =', opt.data.bundle)
        this._dht.post(DhtEvent.remoteGossipBundle(
          opt.from, opt.data.bundle))
        return
      case 'gossipNewTrack':
        log.t('@@@@ ' + this.me() + ' new track', opt.data.agentId, opt.data.dnaAddress)
        // get peer transport
        if (!this._peerList.has(opt.from)) {
          log.w('received gossipNewTrack from unknown peer', this.nick(opt.from))
          return
        }
        peerTransport = this._peerList.get(opt.from)
        // Bookkeep agentId -> PeerId
        this._agent2peer.set(opt.data.agentId, opt.from)
        // Add peer to dht
        const peerHoldEvent = DhtEvent.peerHoldRequest(
          opt.from,
          peerTransport,
          Buffer.from(opt.data.agentId).toString('base64'),
          Date.now())
        // this._dht.post(peerHoldEvent)
        this._handleDhtEvent(peerHoldEvent)
        return
      case 'gossipAllTracks':
        // get peer transport
        if (!this._peerList.has(opt.from)) {
          log.w(this.me() + ' received gossipAllTracks from unknown peer', this.nick(opt.from))
          return
          // this._peerList[opt.from] = opt.data.transport
        }
        peerTransport = this._peerList.get(opt.from)
        // per agentId (FIXME handle dna)
        for (const agentId of opt.data.dnaByAgent) {
          log.t('@@@@ ' + this.me() + ' new track(s)', agentId)
          // Bookkeep agentId -> PeerId
          this._agent2peer.set(agentId, opt.from)
          // Add peer to dht
          const peerHoldEvent = DhtEvent.peerHoldRequest(
            opt.from,
            peerTransport,
            Buffer.from(agentId).toString('base64'),
            Date.now())
          // this._dht.post(peerHoldEvent)
          this._handleDhtEvent(peerHoldEvent)
        }
        return
      case 'handleSendMessage':
        log.t(this.me() + ' Received P2P handleSendMessage', opt.data)

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

    throw new Error('Received unexpected p2p message from "' + opt.from + '" ' + JSON.stringify(
      opt.data))
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
          // const b64 = getHash(JSON.stringify(data))
          const b64 = Buffer.from(JSON.stringify(data)).toString('base64')
          this._dht.post(DhtEvent.dataHoldRequest(data.address, b64))

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
            const b64 = Buffer.from(JSON.stringify(data)).toString('base64')
            this._dht.post(DhtEvent.dataHoldRequest(data.entryAddress, b64))
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
      this._memory[dnaAddress] = mem
    }
    return this._memory[dnaAddress]
  }

  /**
   *  Check if agent is tracking dna.
   *  If not, will try to send a FailureResult back to sender (if sender info is provided).
   *  Returns transportId of receiverAgentId if agent is tracking dna.
   *  @private
   */
  _getTransportIdOrFail (dnaAddress, receiverAgentId, senderAgentId, requestId) {
    // const peer = this._dht.getPeerLocal(receiverAgentId)
    const peerId = this._agent2peer.get(receiverAgentId)
    if (peerId) {
      log.t('oooo CHECK OK for (agent)"' + receiverAgentId + '" + (DNA) "' + dnaAddress + '" = ' + peerId.substring(2, 6))
      return peerId
    }

    // Send FailureResult back to IPC, should be senderAgentId
    log.e('#### CHECK FAILED for (agent) "' + receiverAgentId + '" + (DNA) "' + dnaAddress + '" (sender: ' + senderAgentId + ')')
    this._ipcSend('json', {
      method: 'failureResult',
      dnaAddress: dnaAddress,
      _id: requestId,
      toAgentId: senderAgentId,
      errorInfo: 'No routing for agent id "' + receiverAgentId + '"'
    })
    // Done
    return null
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

    // Bookkeep agentId -> dnaAddress
    this._ipcAddTrack(agentId, dnaAddress)

    // Bookkeep agentId -> PeerId
    this._agent2peer.set(agentId, this._p2p.getId())
    // // Hold ourselves in the DHT
    // this._handleDhtEvent(
    //   DhtEvent.peerHoldRequest(
    //     this._p2p.getId(), // agentId
    //     this._p2p.getTransport(), // null, // this._p2p.getId(),
    //     agentId.toString('base64'), // this._p2p.getId(),
    //     Date.now()
    //   )
    // )
    // Send 'peerConnected' to self
    this._ipcSend('json', {
      method: 'peerConnected',
      agentId: agentId
    })

    // Notify all known peers? first peer? of Dna Tracking by Agent
    log.t('peerList', this._peerList)
    for (const peerAddress of this._peerList.keys()) {
      this._p2pSend(peerAddress, {
        type: 'gossipNewTrack', agentId, dnaAddress
      })
    }

    // Send get lists requests to Core
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
}

exports.N3hHackMode = N3hHackMode
