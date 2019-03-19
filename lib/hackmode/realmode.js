const msgpack = require('msgpack-lite')

const { P2p } = require('../n3h-mod-spec/index')
const { P2pBackendHackmodePeer } = require('../hackmode/p2p-backend-hackmode-peer')

const { N3hMode } = require('../n3h-ipc/n3hMode')

const { RealMem, getHash } = require('./realmem')

const tweetlog = require('../tweetlog/index')
const log = tweetlog('@realmode@')

const { DhtBackendFullsync } = require('../n3h-mod-dht-fullsync/index')

const {
  Dht,
  DhtEvent
} = require('../n3h-mod-spec/index')

const { $sleep } = require('../n3h-common')

/**
 * N3h "realmode" prototyping code
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
class N3hRealMode extends N3hMode {
  async init (workDir, rawConfigData) {
    await super.init()

    this._requestBook = new Map()

    this._peerList = []
    this._dhtPerDna = {}

    await Promise.all([
      this._initP2p()
    ])

    // make sure this is output despite our log settings
    console.log('#P2P-BINDING#:' + this._p2p.getAdvertise())
    console.log('#P2P-READY#')
  }

  // -- private -- //

  /**
   * Convert a peerId into log friendly format
   */
  nick (peerId) {
    return '(' + peerId.substring(2, 6) + ')'
  }

  /**
   * Convert my peerId into log friendly format
   */
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
    log.i(this.me() + 'p2p bound', this._p2p.getAdvertise())
  }

  /**
   * @private
   */
  async _handleIpcJson (data, ipcSenderId) {
    log.t(this.me() + ' Received from Core:', data)

    let tId
    let bucketId
    let result
    let ipcMsg
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
          log.t(this.me() + ' connected', data.address)
        }, (err) => {
          log.e(this.me() + '.connect (' + data.address + ') failed', err.toString())
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
        log.t(this.me() + ' publish Entry', data)
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
          log.t(this.me() + ' publish Meta', metaId)
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
        // Ask my data DHT
        // TODO: might need to do dht.post(DhtEvent.fetchData) instead for non-fullsync DHT
        result = await this._getDhtRef(data.dnaAddress).fetchDataLocal(data.address)
        // log.d(this.me() + ' fetchDataLocal', result)
        if (result) {
          result = JSON.parse(Buffer.from(result, 'base64').toString('utf8'))
          log.d(this.me() + ' fetchDataLocal', result)
          ipcMsg = {
            method: 'fetchEntryResult',
            _id: data._id,
            dnaAddress: data.dnaAddress,
            requesterAgentId: data.requesterAgentId,
            providerAgentId: result.entry.providerAgentId,
            address: data.address,
            content: result.entry.content
          }
        } else {
          ipcMsg = {
            method: 'failureResult',
            _id: data._id,
            dnaAddress: data.dnaAddress,
            toAgentId: data.requesterAgentId,
            errorInfo: 'Entry not found:' + data.address
          }
        }
        this._ipcSend('json', ipcMsg)
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
          log.t(this.me() + ' handleFetchEntryResult insert:', data, isPublish)
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
        // Ask my data DGT
        // TODO: might need to do dht.post(DhtEvent.fetchData) instead for non-fullsync DHT
        result = await this._getDhtRef(data.dnaAddress).fetchDataLocal(data.entryAddress)
        if (result) {
          result = JSON.parse(Buffer.from(result, 'base64').toString('utf8'))
          log.d(this.me() + ' fetchMeta.fetchDataLocal', result)
          // Search for meta of requested attribute
          let contentList = []
          for (const meta of result.meta) {
            if (meta.attribute === data.attribute) {
              contentList.push(meta.contentList[0])
            }
          }
          // Determine providerAgentId ; Entry might not exist
          let fromAgentId = result.dataFetchProviderAgentId
          if (!(Object.entries(result.entry).length === 0 && result.entry.constructor === Object)) {
            fromAgentId = result.entry.providerAgentId
          }
          // Create ipc message
          ipcMsg = {
            method: 'fetchMetaResult',
            _id: data._id,
            dnaAddress: data.dnaAddress,
            requesterAgentId: data.requesterAgentId,
            providerAgentId: fromAgentId,
            entryAddress: data.entryAddress,
            attribute: data.attribute,
            contentList: contentList
          }
        } else {
          ipcMsg = {
            method: 'failureResult',
            _id: data._id,
            dnaAddress: data.dnaAddress,
            toAgentId: data.requesterAgentId,
            errorInfo: 'Entry not found during fetchMeta for:' + data.entryAddress
          }
        }
        this._ipcSend('json', ipcMsg)
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
            log.t(this.me() + ' handleFetchMetaResult insert:', metaContent, data.providerAgentId, metaId, isPublish)
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
          // log.t(this.me() + 'Sending IPC:', fetchEntry)
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
          // log.t(this.me() + 'Sending IPC:', fetchEntry)
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
          log.t(this.me() + ' handleGetPublishingMetaListResult, unknown metaId = ', metaId)
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
          // log.t(this.me() + 'Sending IPC:', fetchMeta)
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
          // log.t(this.me() + ' Sending to Core:', fetchMeta)
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
   * _dhtPerDna is notifying me of a DHT event
   * @private
   */
  async _handleDhtEvent (e, dnaAddress) {
    // log.t(this.me() + '._handleDhtEvent(' + e.type + ') - ' + dnaAddress)
    // Handle event by type
    switch (e.type) {
      case 'peerHoldRequest':
        // issued by dht._handlePeerMap() , i.e. when receiving Peer data from gossip
        // or manually called when receiving 'gossipNewTrack'
        log.t(this.me() + ' received PEER data', e)
        // Store Peer info in Data DHT as peer data
        if (!(dnaAddress in this._dhtPerDna)) {
          log.w('Received peerHoldRequest for untracked DNA', dnaAddress)
          break
        }
        this._getDhtRef(dnaAddress).post(e)
        // Notify my Core of connected Agent
        const agentId = e.peerAddress
        log.t(this.me() + ' PEER INDEXED', this.nick(e.peerTransport.substring(5)), agentId)
        this._ipcSend('json', {
          method: 'peerConnected',
          agentId
        })
        break
      case 'gossipTo':
        // issued by dht._gossip() or dht._onRemoteGossipHandle()
        // log.t(this.me() + ' gossipTo:', e)
        for (const peerId of e.peerList) {
          // if peerId is agentId, get transportId
          let tId = peerId
          const peer = this._getDhtRef(dnaAddress).getPeerLocal(peerId)
          if (peer) {
            tId = peer.peerTransport.substring(5) // remove 'hc://'
            // log.t(this.me() + ' >> ' + peerId + this.nick(tId) + ' - dhtGossip')
          }
          // else {
          //   log.t('\'gossipTo\' peerId is not an agentId')
          //   log.t(this.me() + ' >> ' + peerId + ' - dhtGossip')
          // }
          this._p2pSend(tId, {
            type: 'dhtGossip', dnaAddress, bundle: e.bundle
          })
        }
        break
      case 'dataHoldRequest':
        // issued by dht._handleDataMap() which got triggered by a 'fetchAddressListResp'
        // data should be an entryWithMeta
        // log.t(this.me() + '  dataHoldRequest: ', e.data)
        const data = JSON.parse(Buffer.from(e.data, 'base64'))
        // Check if we are receiving only meta
        const hasEntry = !(Object.entries(data.entry).length === 0 && data.entry.constructor === Object)
        log.t(this.me() + ' dataHoldRequest:', hasEntry, data)
        // Store data in Mem & data DHT (done by indexers
        let fromAgentId = data.dataFetchProviderAgentId
        if (hasEntry) {
          fromAgentId = data.entry.providerAgentId
          this._getMemRef(data.dnaAddress).insert(data.entry)
        }
        for (const metaItem of data.meta) {
          this._getMemRef(data.dnaAddress).insertMeta({
            type: 'dhtMeta',
            providerAgentId: fromAgentId,
            entryAddress: data.entryAddress,
            attribute: metaItem.attribute,
            contentList: metaItem.contentList
          })
        }
        break
      case 'dataFetch':
        // Issued by dht._fetchDataLocal()
        // My dht asked me for all the data of an entry, give it a response
        log.t(this.me() + ' dataFetch', e)
        // Get entryAddress
        const entryAddress = e.dataAddress
        // log.e(this.me() + ' entryAddress', entryAddress)

        // Check if DNA has that entryAddress
        const mem = this._getMemRef(dnaAddress)

        // If data not found, respond with 'null'
        if (!mem.has(entryAddress)) {
          log.e(this.me() + ' doest not have entry ' + entryAddress)
          const nullB64 = Buffer.from(JSON.stringify(null), 'utf8').toString('base64')
          this._getDhtRef(dnaAddress).post(Dht.DhtEvent.dataFetchResponse(e.msgId, nullB64))
          break
        }
        // Create DHT data item
        let dhtData = mem.get(entryAddress)
        dhtData.entryAddress = entryAddress
        dhtData.dnaAddress = dnaAddress
        dhtData.dataFetchProviderAgentId = null
        // Pick first agent who tracks this DNA as the provider
        // WARNING non-deterministic if many agents track the same DNA
        for (const [agentId, dnas] of this._ipcDnaByAgent) {
          if (dnas.has(dnaAddress)) {
            dhtData.dataFetchProviderAgentId = agentId
            break
          }
        }
        if (!dhtData.dataFetchProviderAgentId) {
          log.e(this.me() + ' AgentId not found for DNA ' + dnaAddress + ' ; during handleDhtEvent(dataFetch)')
        }
        log.t(this.me() + ' dataFetchResponse:', dhtData)
        dhtData = Buffer.from(JSON.stringify(dhtData), 'utf8').toString('base64')
        this._getDhtRef(dnaAddress).post(Dht.DhtEvent.dataFetchResponse(e.msgId, dhtData))
        break
      default:
        throw new Error('unhandled dht event type ' + e.type + ' ' + JSON.stringify(e))
    }
  }

  /**
   * send/publish a p2p message to a Peer
   * @private
   */
  async _p2pSend (peerAddress, obj) {
    // log.t(this.me() + ' >>> ' + this.nick(peerAddress) + ' - ' + obj.type)
    return this._p2p.publishReliable(
      [peerAddress],
      msgpack.encode(obj).toString('base64')
    )
  }

  /**
   * send/publish a p2p message to all know Peers
   * @private
   */
  async _p2pSendAll (obj) {
    // log.t(this.me() + ' >>> ' + this._peerList + ' - ' + obj.type)
    return this._p2p.publishReliable(
      this._peerList,
      msgpack.encode(obj).toString('base64')
    )
  }

  /**
   * _p2p is notifying me of p2p events
   * @private
   */
  _handleP2pEvent (evt) {
    // log.t(this.me() + '._handleP2pEvent()', evt.type)
    switch (evt.type) {
      case 'peerConnect':
        log.t(this.me() + '.peerConnect', this.nick(evt.peerAddress))
        // Bookkeep known peers
        this._peerList.push(evt.peerAddress)
        // Gossip back my tracked DNA (and agents)
        // convert to array
        let dnaByAgent = []
        for (const [agentId, dnas] of this._ipcDnaByAgent) {
          // log.t(this.me() + '.gossipAllTracks.' + agentId, Array.from(dnas))
          for (const dnaAddress of dnas) {
            let dnaAgent = []
            dnaAgent.push(agentId)
            dnaAgent.push(dnaAddress)
            dnaByAgent.push(dnaAgent)
          }
        }
        // log.t(this.me() + '.gossipAllTracks', this._ipcDnaByAgent)
        log.t(this.me() + '.gossipAllTracks', dnaByAgent)
        this._p2pSend(evt.peerAddress, {
          type: 'gossipAllTracks',
          dnaByAgent: dnaByAgent
        })
        break
      case 'handlePublish':
        // Handle 'publish' message sent from some other peer's _p2pSend()
        this._handleP2pPublish({
          from: evt.fromPeerAddress,
          data: msgpack.decode(Buffer.from(evt.data, 'base64'))
        })
        break
      // case 'handleRequest':
      default:
        throw new Error('unexpected event type: ' + evt.type)
    }
  }

  /**
   * Received P2P message from other Peer
   * Might send some messages back and
   * transcribe received message into a local IPC message.
   * @private
   */
  _handleP2pPublish (opt) {
    // log.t(this.me() + ' << ' + this.nick(opt.from) + ' - ' + opt.data.type)
    switch (opt.data.type) {
      case 'dhtGossip':
        // log.t(this.me() + ' bundle =', opt.data.bundle)
        this._getDhtRef(opt.data.dnaAddress).post(
          DhtEvent.remoteGossipBundle(opt.from, opt.data.bundle)
        )
        return
      case 'gossipNewTrack':
        // Some peer is telling us its tracking a new DNA
        log.t(this.me() + ' @@@@ ' + this.me() + ' new track', opt.data.agentId, opt.data.dnaAddress)
        // get peer transport
        if (!this._peerList.includes(opt.from)) {
          log.w('received gossipNewTrack from unknown peer', this.nick(opt.from))
          return
        }
        // Add peer to dht if we also track the same DNA (this will Bookkeep agentId -> PeerId)
        const peerHoldEvent = DhtEvent.peerHoldRequest(
          opt.data.agentId,
          'hc://' + opt.from,
          Buffer.from('').toString('base64'),
          Date.now())
        // dht.post(peerHoldEvent)
        this._handleDhtEvent(peerHoldEvent, opt.data.dnaAddress)
        return
      case 'gossipAllTracks':
        // Some peer is telling us of all the DNA it is tracking
        // log.t(this.me() + ' << ' + this.nick(opt.from) + ' - gossipAllTracks', opt.data)
        // get peer transport
        if (!this._peerList.includes(opt.from)) {
          log.w(this.me() + ' received gossipAllTracks from unknown peer', this.nick(opt.from))
          return
        }
        // Add peer for each data dht
        for (const [agentId, dnaAddress] of opt.data.dnaByAgent) {
          log.t(this.me() + ' @@@@ ' + this.me() + ' new track(s)', agentId, dnaAddress)

          // Bookkeep agentId -> PeerId
          // Add peer to dht (this Bookkeep agentId -> PeerId)
          const peerHoldEvent = DhtEvent.peerHoldRequest(agentId, 'hc://' + opt.from, Buffer.from('').toString('base64'), Date.now())
          // Trigger manually as if it came from gossip
          this._handleDhtEvent(peerHoldEvent, dnaAddress)
        }
        return
      case 'handleSendMessage':
        log.t(this.me() + ' Received P2P handleSendMessage', opt.data)
        // Send error back to sender if we untracked this DNA
        if (!this._ipcHasTrack(opt.data.toAgentId, opt.data.dnaAddress)) {
          log.e(this.me() + ' #### P2P hasTrack() failed for agent "' + opt.data.toAgentId + '" ; DNA = "' + opt.data.dnaAddress + '"')
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
        // forward to Core
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
        // forward to Core
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
        // forward to Core
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
        // forward to Core
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
        // forward to Core
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
   * Create and initialize a new DHT for a dnaAddress
   * @param dnaAddress
   * @param agentId
   * @returns {Dht}
   * @private
   */
  async _initDht (dnaAddress, agentId) {
    // log.t(this.me() + '_initDht', dnaAddress, agentId)
    // pre-conditions
    if (!dnaAddress || typeof dnaAddress !== 'string' || !dnaAddress.length) {
      throw new Error('cannot _initDht without dnaAddress string')
    }
    if (!agentId || typeof agentId !== 'string' || !agentId.length) {
      throw new Error('cannot _initDht without agentId string')
    }
    // Setup init data
    const dhtInitOptions = { thisPeer: DhtEvent.peerHoldRequest(
      agentId,
      'hc://' + this._p2p.getId(),
      Buffer.from('self').toString('base64'),
      Date.now())
    }
    // Construct
    let dht = await new Dht(DhtBackendFullsync, dhtInitOptions)
    // Set event handler
    dht.on('event', e => this._handleDhtEvent(e, dnaAddress).catch(err => {
      console.error('Error while handling DhtEvent', e, err)
      process.exit(1)
    }))
    // Add to "Map"
    this._dhtPerDna[dnaAddress] = dht
  }

  /**
   * @private
   */
  _getDhtRef (dnaAddress) {
    if (!dnaAddress || typeof dnaAddress !== 'string' || !dnaAddress.length) {
      throw new Error('cannot _getDhtRef without dnaAddress string')
    }
    if (!(dnaAddress in this._dhtPerDna)) {
      throw new Error('_getDhtRef FAILED')
    }
    return this._dhtPerDna[dnaAddress]
  }

  /**
   * @private
   */
  _getMemRef (dnaAddress) {
    if (!(dnaAddress in this._memory)) {
      const mem = new RealMem()
      // send IPC handleStoreEntry on inserting a dhtEntry
      mem.registerIndexer((store, data) => {
        if (data && data.type === 'dhtEntry') {
          // Store hash in DHT
          log.t(this.me() + ' got dhtEntry', data)
          const contentHash = getHash(JSON.stringify(data.content))

          this._getDhtRef(dnaAddress).post(DhtEvent.dataHoldRequest(data.address, contentHash))

          // Store in Core if it isn't already holding it
          if (this._hasEntry(dnaAddress, data.address)) {
            log.t(this.me() + ' dhtEntry is known:', data.address)
            return
          }
          log.t(this.me() + ' dhtEntry is unknown', data.address)
          // bookkeep
          this._bookkeepAddress(this._storedEntryBook, dnaAddress, data.address)
          // log.t(this.me() + ' Sending IPC handleStoreEntry: ', data.address)
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
          log.t(this.me() + ' got dhtMeta', data)
          let toStoreList = []
          let dht = this._getDhtRef(dnaAddress)
          for (const metaContent of data.contentList) {
            const metaId = this._metaIdFromTuple(data.entryAddress, data.attribute, metaContent)
            // Store hash of metaContent in DHT
            const contentHash = getHash(metaId)

            dht.post(DhtEvent.dataHoldRequest(data.entryAddress, contentHash))

            // Store in Core if Core isn't already holding it
            if (this._hasMeta(dnaAddress, metaId)) {
              log.t('metaContent is known:', metaContent)
              continue
            }
            log.t('metaContent is unknown:', metaContent)
            this._bookkeepAddress(this._storedMetaBook, dnaAddress, metaId)
            toStoreList.push(metaContent)
          }
          // Send toStoreList to Core
          // log.t(this.me() + ' Sending IPC handleStoreMeta: ', toStoreList)
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
    const peer = this._getDhtRef(dnaAddress).getPeerLocal(receiverAgentId)
    if (!peer) {
      // Send FailureResult back to IPC, should be senderAgentId
      log.e(this.me() + ' #### CHECK FAILED for (agent) "' + receiverAgentId + '" + (DNA) "' + dnaAddress + '" (sender: ' + senderAgentId + ')')
      this._ipcSend('json', {
        method: 'failureResult',
        dnaAddress: dnaAddress,
        _id: requestId,
        toAgentId: senderAgentId,
        errorInfo: 'No routing for agent id "' + receiverAgentId + '"'
      })
      return null
    }
    const peerId = peer.peerTransport.substring(5) // remove 'hc://'
    log.t(this.me() + ' oooo CHECK OK for (agent)"' + receiverAgentId + '" + (DNA) "' + dnaAddress + '" = ' + this.nick(peerId))
    return peerId
  }

  /**
   * @private
   */
  _untrack (dnaAddress, agentId) {
    log.t(this.me() + ' _untrack() for "' + agentId + '" for DNA "' + dnaAddress + '"')
    this._ipcRemoveTrack(agentId, dnaAddress)
  }

  /**
   * @private
   */
  async _track (dnaAddress, agentId) {
    log.t(this.me() + ' _track', dnaAddress, agentId)
    // Bookkeep agentId -> dnaAddress
    this._ipcAddTrack(agentId, dnaAddress)
    // Init DHT for this DNA and bookkeep agentId -> PeerId for self
    if (!(dnaAddress in this._dhtPerDna)) {
      await this._initDht(dnaAddress, agentId)
    } else {
      const peerHoldEvent = DhtEvent.peerHoldRequest(
        agentId,
        'hc://' + this._p2p.getId(),
        Buffer.from('').toString('base64'),
        Date.now())
      this._handleDhtEvent(peerHoldEvent, agentId)
    }

    // Make sure thisPeer data is stored
    const dht = this._getDhtRef(dnaAddress)
    let time = 0
    while (!dht.getPeerLocal(agentId) && time < 1000) {
      await $sleep(10)
      time += 10
    }
    if (time >= 1000) {
      throw new Error('peerHoldRequest timed out during _track')
    }
    log.i(this.me() + ' REGISTERED AGENT', agentId, dnaAddress, dht.getPeerLocal(agentId).peerTransport)

    // Send 'peerConnected' of self to Core
    this._ipcSend('json', {
      method: 'peerConnected',
      agentId: agentId
    })
    // Notify all known peers of DNA tracking by this agent
    this._p2pSendAll({ type: 'gossipNewTrack', agentId, dnaAddress })
    // Send get * lists requests to Core
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

exports.N3hRealMode = N3hRealMode
