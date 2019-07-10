const msgpack = require('msgpack-lite')

const { P2pBackendHackmodePeer } = require('../hackmode/p2p-backend-hackmode-peer')

const { N3hMode } = require('../n3h-ipc/n3hMode')

const { RealMem } = require('./realmem')

const tweetlog = require('../tweetlog/index')
const log = tweetlog('@realmode@')

const { DhtFullSync2 } = require('../n3h-mod-dht-fullsync/index')
const { DiscoveryMdns } = require('../n3h-mod-discovery-mdns')

const {
  Dht,
  DhtEvent
} = require('../interface')

const { $sleep } = require('../n3h-common')

/**
 * N3h "realmode" prototyping code
 *
 * Expects a config either over stdin or as a file `n3h-config.json` in the
 * working directory.
 * If neither is supplied, will load up the following default:
 *
 * ```
 * {
 *   "webproxy": {
 *     "connection": {
 *       "rsaBits": 1024,
 *       "bind": [
 *         "wss://0.0.0.0:0/"
 *       ]
 *     },
 *     "wssAdvertise": "auto",
 *     "wssRelayPeers": null
 *   }
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
  async init (workDir, rawConfigData, terminate) {
    await super.init(workDir, rawConfigData, terminate)

    // "Map" of chainDhts: (chainId -> DhtFullSync2 instance)
    this._dhtPerChain = {}
    // (machineId -> (dnaId -> [agentId]))
    // Keep track of dna tracking by agentId and machineId
    this._peerTracks = {}
    // Map of requestId -> ChainId
    // Used for tracking dataFetch requests from dht gossip sent to Core
    this._dhtRequestBook = new Map()
    // Set of entryAddress for which we sent a `handleFetchEntry` to Core and are waiting for a response
    this._dhtEntryRequestPendingList = new Set()
    // Map of requestId -> agentId
    // Used for keeping track of from whom I request was from.
    this._fromAgentMap = new Map()

    await Promise.all([
      this._initP2p()
    ])

    if (this._config.mdns.enabled) {
      this._mdns = (await new DiscoveryMdns({
        id: this._config.network.idHash,
        port: this._config.mdns.port,
        advertise: this._p2p.getAdvertise()
      })).discoveryInterface

      this._mdns.on('event', e => {
        if (e.type === 'discovery') {
          for (let uri of e.uriList) {
            if (uri === this._p2p.getAdvertise()) {
              continue
            }
            this._p2p.transportConnect(uri).then(res => {
              if (res.isNew) {
                log.t(this.me() + ' connected from MDNS discovery', uri)
              }
            }, (err) => {
              log.e(this.me() + '.connect (' + uri + ') MDNS failed', err.toString())
            }).catch(e => {})
          }
        }
      })
    }

    this.$pushDestructor(async () => {
      if (this._mdns) {
        await this._mdns.destroy()
      }
      this._mdns = null
      if (this._p2p) {
        await this._p2p.destroy()
      }
      this._p2p = null
      for (let chainId in this._dhtPerChain) {
        await this._dhtPerChain[chainId].destroy()
      }
      this._dhtPerChain = null
      this._dhtRequestBook.clear()
      this._dhtRequestBook = null
      this._dhtEntryRequestPendingList.clear()
      this._dhtEntryRequestPendingList = null
      this._fromAgentMap.clear()
      this._fromAgentMap = null
    })

    // make sure this is output despite our log settings
    console.log('#P2P-BINDING#:' + this._p2p.getAdvertise())
    console.log('#P2P-READY#')
  }

  getAdvertise () {
    return this._p2p.getAdvertise()
  }

  // -- private -- //

  /**
   * Convert a peerAddress into log friendly format
   */
  nick (peerAddress) {
    return '(' + peerAddress.substring(2, 6) + ')'
  }

  /**
   * Convert my peerAddress into log friendly format
   */
  me () {
    if (this._p2p && this._p2p.getId()) {
      return this.nick(this._p2p.getId())
    }
    return '(xxxx)'
  }

  /**
   *  remove 'hc://'
   */
  toMachineId (peerTransport) {
    return peerTransport.substring(5)
  }

  /**
   * Add 'hc://'
   */
  toDnaPeerTransport (mId) {
    return 'hc://' + mId
  }

  /**
   * @private
   */
  async _initP2p () {
    // Create p2p config
    const p2pConf = {
      useTransientTransportId: this._config.network.useTransientTransportId,
      dht: {},
      connection: {
        // TODO - allow some kind of environment var?? for setting passphrase
        passphrase: 'hello',
        rsaBits: this._config.webproxy.connection.rsaBits,
        bind: this._config.webproxy.connection.bind
      },
      workDir: this._workDir
    }
    if (this._config.webproxy.wssRelayPeers) {
      p2pConf.wssRelayPeers = this._config.webproxy.wssRelayPeers
    } else {
      p2pConf.wssAdvertise = this._config.webproxy.wssAdvertise
    }

    // Create P2p
    this._p2p = (await new P2pBackendHackmodePeer(p2pConf)).interfaceP2p
    this._p2p.on('event', evt => this._handleP2pEvent(evt))

    // Done
    log.i(this.me() + 'p2p bound', this._p2p.getAdvertise())
  }

  /**
   * have an agent send a message to another agent (without knowing on which machine the receiver agent is)
   * @param msg - Message to send
   * @param fromChainId - Sender space and agentId
   * @param toAgentId - Receiver agentId
   * @param reqId - Optional requestId it is responding to.
   * @private
   */
  async _sendToAgent (fromChainId, toAgentId, msg, reqId) {
    const mId = this._getMachineIdOrFail(fromChainId, toAgentId, reqId)
    if (mId === null) {
      log.w('No known machineId for agent ' + toAgentId + ' in space ' + fromChainId)
      return
    }
    // If machineId is self, send via IPC
    if (mId === this._p2p.getId()) {
      msg.method = msg.type
      this._ipcSend('json', msg)
    } else {
      this._p2pSend(mId, msg)
    }
  }

  /**
   * @private
   */
  async _handleIpcJson (data, ipcSenderId) {
    log.t(this.me() + ' Received from Core:', data.method)

    let chainId
    let msg
    switch (data.method) {
      case 'failureResult':
        // Note: data is a GenericResultData
        // Check if its a response to our own request
        chainId = this._checkRequest(data._id)
        if (chainId !== '') {
          return
        }
        const fromAgentId = this._fromAgentMap.get(data._id)
        if (!fromAgentId) {
          log.e('Received failureResult from unknown agent', data._id)
          return
        }
        this._fromAgentMap.delete(data._id)
        chainId = this._intoChainId(data.dnaAddress, fromAgentId)
        // if not, relay to receipient if possible
        msg = {
          type: 'failureResult',
          dnaAddress: data.dnaAddress,
          _id: data._id,
          toAgentId: data.toAgentId,
          resultInfo: data.resultInfo
        }
        this._sendToAgent(chainId, data.toAgentId, msg, data._id)
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
        // Note: data.peerAddress must be an Advertise
        // Connect to Peer
        this._p2p.transportConnect(data.peerAddress).then(res => {
          if (res.isNew) {
            log.t(this.me() + ' connected from IPC request', data.peerAddress)
          }
        }, (err) => {
          log.e(this.me() + '.connect (' + data.peerAddress + ') IPC failed', err.toString())
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
        // Forward message to receiving agent
        msg = {
          type: 'handleSendMessage',
          _id: data._id,
          dnaAddress: data.dnaAddress,
          toAgentId: data.toAgentId,
          fromAgentId: data.fromAgentId,
          data: data.data
        }
        chainId = this._intoChainId(data.dnaAddress, data.fromAgentId)
        this._sendToAgent(chainId, data.toAgentId, msg, data._id)
        return
      case 'handleSendMessageResult':
        // Note: data is a MessageData
        // Sender must TrackDna
        if (!this._hasTrackOrFail(data.fromAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Forward message to receiving agent
        msg = {
          type: 'sendMessageResult',
          _id: data._id,
          dnaAddress: data.dnaAddress,
          toAgentId: data.toAgentId,
          fromAgentId: data.fromAgentId,
          data: data.data
        }
        chainId = this._intoChainId(data.dnaAddress, data.fromAgentId)
        this._sendToAgent(chainId, data.toAgentId, msg, data._id)
        return
      case 'publishEntry':
        // Note: data is a ProvidedEntryData
        let reqId = 'publishEntry_' + this.nick(data.entry.entryAddress)
        if (!this._hasTrackOrFail(data.providerAgentId, data.dnaAddress, reqId)) {
          return
        }
        chainId = this._intoChainId(data.dnaAddress, data.providerAgentId)
        // Broadcast & book-keep each aspect
        log.t(this.me() + ' publish Entry', data)
        for (const entryAspect of data.entry.aspectList) {
          this._bookkeepAspect(this._authoredEntryBook, chainId, data.entry.entryAddress, entryAspect.aspectAddress)
          // publish
          // encodedAspect: Buffer.from(aspect).toString('base64')
          // Insert to mem with content for broadcasting
          this._getMemRef(chainId).insert({
            type: 'entryAspect',
            entryAddress: data.entry.entryAddress,
            aspectAddress: entryAspect.aspectAddress,
            providerAgentId: data.providerAgentId,
            aspect: {
              aspectAddress: entryAspect.aspectAddress,
              typeHint: entryAspect.typeHint,
              publishTs: entryAspect.publishTs,
              aspect: entryAspect.aspect
              // encodedContent: Buffer.from(entryAspect.aspect).toString('base64')
            }
          })
        }
        return
      case 'queryEntry':
        // Note: data is a QueryEntryData
        if (!this._hasTrackOrFail(data.requesterAgentId, data.dnaAddress, data._id)) {
          return
        }
        this._fromAgentMap.set(data._id, data.requesterAgentId)
        // #fullsync Send request back to self (ipc)
        data.method = 'handleQueryEntry'
        this._ipcSend('json', data)
        return
      case 'handleQueryEntryResult':
        // Note: data is a QueryEntryResultData
        this._fromAgentMap.delete(data._id)
        if (!this._hasTrackOrFail(data.responderAgentId, data.dnaAddress, data._id)) {
          return
        }
        // #fullsync Send response back to self (ipc)
        data.method = 'queryEntryResult'
        this._ipcSend('json', data)
        return
      case 'handleFetchEntryResult':
        // Note: data is a FetchEntryResultData
        if (!this._hasTrackOrFail(data.providerAgentId, data.dnaAddress, data._id)) {
          return
        }
        // if this message is a response from our own request, Broadcast & book-keep
        chainId = this._checkRequest(data._id)
        if (chainId !== '') {
          for (const entryAspect of data.entry.aspectList) {
            log.t(this.me() + ' handleFetchEntryResult insert:', data)
            this._bookkeepAspect(this._authoredEntryBook, chainId, data.entry.entryAddress, entryAspect.aspectAddress)
            this._getMemRef(chainId).insert({
              type: 'entryAspect',
              providerAgentId: data.providerAgentId,
              entryAddress: data.entry.entryAddress,
              aspectAddress: entryAspect.aspectAddress,
              aspect: {
                aspectAddress: entryAspect.aspectAddress,
                typeHint: entryAspect.typeHint,
                publishTs: entryAspect.publishTs,
                aspect: entryAspect.aspect
                // encodedContent: Buffer.from(entryAspect.aspect).toString('base64')
              }
            })
          }
          return
        }
        // Otherwise send back to gossip requester
        // =======================================

        // if this message is a response from our own request, Broadcast & book-keep
        chainId = this._dhtRequestBook.get(data._id)
        if (!chainId) {
          log.w('Received unknown handleFetchEntryResult', data._id)
          return
        }
        // log.t('_dhtRequestBook? ', data._id, chainId)
        this._dhtRequestBook.delete(data._id)
        this._dhtEntryRequestPendingList.delete(data.entry.entryAddress)
        let entryData = []
        for (const entryAspect of data.entry.aspectList) {
          log.t(this.me() + ' handleFetchEntryResult insert:', data)
          this._bookkeepAspect(this._authoredEntryBook, chainId, data.entry.entryAddress, entryAspect.address)
          const aspectData = {
            type: 'entryAspect',
            providerAgentId: data.providerAgentId,
            entryAddress: data.entry.entryAddress,
            aspectAddress: entryAspect.aspectAddress,
            aspect: {
              aspectAddress: entryAspect.aspectAddress,
              typeHint: entryAspect.typeHint,
              publishTs: entryAspect.publishTs,
              aspect: entryAspect.aspect
              // encodedContent: Buffer.from(entryAspect.aspect).toString('base64')
            }
          }
          entryData.push(Buffer.from(JSON.stringify(aspectData), 'utf8').toString('base64'))
        }
        this._getDhtRef(chainId).post(Dht.DhtEvent.dataFetchResponse(data._id, entryData))
        return
      case 'handleGetAuthoringEntryListResult':
        // Note: data is EntryListData
        // Mark my request as resolved and get chainId from request
        chainId = this._checkRequest(data._id)
        if (chainId === '') {
          log.w(this.me() + ' Received handleGetAuthoringEntryListResult from unknown request')
          return
        }
        // get already known publishing list
        let knownAuthoringEntryList = {}
        if (chainId in this._authoredEntryBook) {
          knownAuthoringEntryList = this._authoredEntryBook[chainId]
        }

        // log.d(this.me() + ' addressMap ' + JSON.stringify(data.addressMap))
        // Send FetchEntry for every new entry or entryAspect
        for (const entryAddress in data.addressMap) {
          const aspectAddressList = data.addressMap[entryAddress]
          for (const aspectAddress of aspectAddressList) {
            // If one aspectAddress is unknown, fetch Entry
            if (!knownAuthoringEntryList[entryAddress] ||
              !knownAuthoringEntryList[entryAddress].has(aspectAddress)) {
              let fetchEntry = {
                method: 'handleFetchEntry',
                dnaAddress: data.dnaAddress,
                providerAgentId: data.providerAgentId,
                _id: this._createRequestWithChainId(chainId),
                entryAddress
              }
              log.t(this.me() + ' handleGetAuthoringEntryListResult - Sending IPC:', fetchEntry)
              this._ipcSend('json', fetchEntry)
              break
            }
          }
        }
        return

      // Ask for data like when Authoring
      case 'handleGetGossipingEntryListResult':
        // Note: data is EntryListData
        // Mark my request as resolved and get chainId from request
        chainId = this._checkRequest(data._id)
        if (chainId === '') {
          log.w(this.me() + ' Received handleGetGossipingEntryListResult from unknown request')
          return
        }
        // log.t(this.me() + ' handleGetGossipingEntryListResult + | ' + chainId)
        // get list of known data
        let knownGossipingEntryList = {}
        if (chainId in this._storedEntryBook) {
          knownGossipingEntryList = this._storedEntryBook[chainId]
        }
        // log.d(this.me() + ' knownGossipingEntryList: ' + JSON.stringify(knownGossipingEntryList))
        // log.d(this.me() + ' addressMap: ' + JSON.stringify(data.addressMap))
        // Send FetchEntry for every new entry or entryAspect
        for (const entryAddress in data.addressMap) {
          const aspectAddressList = data.addressMap[entryAddress]
          for (const aspectAddress of aspectAddressList) {
            // If one aspectAddress is unknown, fetch Entry
            if (!knownGossipingEntryList[entryAddress] ||
              !knownGossipingEntryList[entryAddress].has(aspectAddress)) {
              let fetchEntry = {
                method: 'handleFetchEntry',
                dnaAddress: data.dnaAddress,
                providerAgentId: data.providerAgentId,
                _id: this._createRequestWithChainId(chainId),
                entryAddress
              }
              log.t(this.me() + ' handleGetGossipingEntryListResult - Sending IPC:', fetchEntry)
              this._ipcSend('json', fetchEntry)
              break
            }
          }
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
    let chainId = this._requestBook.get(requestId)
    this._requestBook.delete(requestId)
    return chainId
  }

  /**
   * A chainDHT (or myself) is notifying me of a DHT event
   * @private
   */
  async _handleChainDhtEvent (e, chainId) {
    // log.t(this.me() + '._handleChainDhtEvent(' + e.type + ') - ' + chainId)
    const dnaAddress = this._deconstructChainId(chainId)[0]
    // Handle event by type
    switch (e.type) {
      // issued by dht._handlePeerMap() (i.e. when receiving peer data from gossip)
      // or when receiving 'tracking gossip' (gossipNewTrack, gossipAllTracks)
      case 'peerHoldRequest':
        const toHoldAgentId = e.peerAddress
        const machineId = this.toMachineId(e.peerTransport)
        log.t(this.me() + ' received PEER-AGENT', toHoldAgentId, this.nick(machineId))
        // Bookkeep machineId -> (dnaId -> agentId)
        let peerTracks = this._getPeerRef(machineId)
        let agentList = [toHoldAgentId]
        if (peerTracks.has(dnaAddress)) {
          agentList.concat(peerTracks.get(dnaAddress))
        }
        peerTracks.set(dnaAddress, agentList)
        // Store peer data in chainDHT
        if (!(chainId in this._dhtPerChain)) {
          log.w('Received peerHoldRequest for untracked DNA', chainId)
          break
        }
        this._getDhtRef(chainId).post(e)
        // Notify my Core of connected Agent
        log.t(this.me() + ' PEER-AGENT INDEXED', this.nick(machineId), toHoldAgentId)
        this._ipcSend('json', {
          method: 'peerConnected',
          agentId: toHoldAgentId
        })
        break
      case 'gossipTo':
        // issued by dht._gossip() or dht._onRemoteGossipHandle()
        // log.t(this.me() + ' gossipTo:', e.peerList)
        for (const peerAddress of e.peerList) {
          // Unless its 'reply/response' gossip,
          // peerAddress is actually an agentId, so get agent's real peerAddress from dht peer data
          let mId = peerAddress
          const peer = this._getDhtRef(chainId).getPeerLocal(peerAddress)
          if (peer) {
            mId = this.toMachineId(peer.peerTransport)
          }
          if (mId !== this._p2p.getId()) {
            this._p2pSend(mId, {
              type: 'dnaDhtGossip', dnaAddress, bundle: e.bundle
            })
          }
        }
        break
      case 'dataHoldRequest':
        for (let item of e.dataList) {
          const entryAspect = JSON.parse(Buffer.from(item, 'base64').toString())
          log.t(this.me() + ' dataHoldRequest - ' + JSON.stringify(entryAspect))
          if (entryAspect.type !== 'entryAspect') {
            log.e(this.me() + ' received dataHoldRequest of unknown type')
          } else {
            this._getMemRef(chainId).insert({
              type: 'entryAspect',
              providerAgentId: entryAspect.providerAgentId,
              entryAddress: entryAspect.entryAddress,
              aspectAddress: entryAspect.aspectAddress,
              aspect: entryAspect.aspect
              // aspect: item
              // encodedContent: item
            })
          }
        }
        break
      case 'dataFetch':
        // Issued by dht._fetchDataLocal()
        // My dht asked me for all the data of an entry, forward request to Core as a handleFetchEntry
        log.t(this.me() + ' dataFetch', e)
        const entryAddress = e.dataAddress
        // Check if we have something for that entryAddress
        // If no data found, respond with 'null'
        const mem = this._getMemRef(chainId)
        if (!mem.has(entryAddress)) {
          log.e(this.me() + ' dataFetch -- no data found for entry "' + entryAddress + '"')
          this._getDhtRef(chainId).post(Dht.DhtEvent.dataFetchResponse(e.msgId, []))
          break
        }
        if (this._dhtEntryRequestPendingList.has(entryAddress)) {
          this._getDhtRef(chainId).post(Dht.DhtEvent.dataFetchResponse(e.msgId, []))
          break
        }
        // Respond from cache
        // this._askMem(mem, chainId, e.msgId, entryAddress)
        // or ask Core for data
        this._askCore(chainId, e.msgId, entryAddress)
        break
      case 'peerTimedOut':
        // For now, we don't care about dnaDht peers timing out because we are handling this when
        // a transportDht peer times out.
        log.t(this.me() + ' chainDht peer timed-out:', e.peerAddress, dnaAddress)
        break
      default:
        throw new Error('unhandled dht event type ' + e.type + ' ' + JSON.stringify(e))
    }
  }

  /**
   * Respond to a DHT dataFetch request with data stored in Mem
   * @private
   */
  async _askMem (mem, chainId, msgId, entryAddress) {
    // Create dht entry
    const aspectList = mem.get(entryAddress)
    let entryData = []
    for (const entryAspect of aspectList) {
      const aspectData = {
        type: 'entryAspect',
        providerAgentId: this._deconstructChainId(chainId)[1],
        entryAddress,
        aspectAddress: entryAspect.aspectAddress,
        aspect: {
          aspectAddress: entryAspect.aspectAddress,
          typeHint: entryAspect.typeHint,
          publishTs: entryAspect.publishTs,
          aspect: entryAspect.aspect
        }
      }
      entryData.push(Buffer.from(JSON.stringify(aspectData), 'utf8').toString('base64'))
    }
    // Post dht entry
    this._getDhtRef(chainId).post(Dht.DhtEvent.dataFetchResponse(msgId, entryData))
  }

  /**
   * Respond to a DHT dataFetch request by asking Core for the data
   * @private
   */
  async _askCore (chainId, msgId, entryAddress) {
    log.t('_dhtRequestBook: ', msgId, chainId)
    this._dhtRequestBook.set(msgId, chainId)
    this._dhtEntryRequestPendingList.add(entryAddress)
    let fetchEntry = {
      method: 'handleFetchEntry',
      dnaAddress: this._deconstructChainId(chainId)[0],
      providerAgentId: this._deconstructChainId(chainId)[1],
      _id: msgId,
      entryAddress
    }
    log.t(this.me() + ' dataFetch - Sending IPC:', fetchEntry)
    this._ipcSend('json', fetchEntry)
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
    // don't send to ourselves
    const peerList = this._getPeerList().filter(a => a !== this._p2p.getId())
    // log.t(this.me() + ' >>> ' + peerList + ' - ' + obj.type)
    return this._p2p.publishReliable(
      peerList,
      msgpack.encode(obj).toString('base64')
    )
  }

  /**
   * _p2p is notifying me of p2p events
   * @private
   */
  _handleP2pEvent (evt) {
    // log.t(this.me() + '._handleP2pEvent()', evt.type)
    let peerTracks
    switch (evt.type) {
      case 'peerConnect':
        log.t(this.me() + '.peerConnect:', this.nick(evt.peerAddress))
        // Bookkeep known peers
        peerTracks = this._getPeerRef(evt.peerAddress)
        if (peerTracks.size > 0) {
          log.w(this.me() + ' received peerConnect from a known peer', this.nick(evt.peerAddress), peerTracks.size)
        }
        // Gossip back my tracked DNA+Agents
        // convert to array
        let dnaByAgent = []
        for (const [agentId, dnaList] of this._agentTracks) {
          // log.t(this.me() + '.gossipAllTracks.' + agentId, Array.from(dnaList))
          for (const dnaAddress of dnaList) {
            let dnaAgent = []
            dnaAgent.push(agentId)
            dnaAgent.push(dnaAddress)
            dnaByAgent.push(dnaAgent)
          }
        }
        // log.t(this.me() + '.gossipAllTracks', this._agentTracks)
        log.t(this.me() + '.gossipAllTracks', dnaByAgent)
        this._p2pSend(evt.peerAddress, {
          type: 'gossipAllTracks',
          dnaByAgent: dnaByAgent
        })
        break
      case 'peerDisconnect':
        log.t(this.me() + '.peerDisconnect:', this.nick(evt.peerAddress))
        // For each DNA+agent this peer was part of
        // tell dnaDht to drop peer data
        peerTracks = this._getPeerRef(evt.peerAddress)
        for (const [dnaAddress, agentIdList] of peerTracks) {
          for (const agentId of agentIdList) {
            log.t(this.me() + ' PEER-AGENT DISCONNECTED', this.nick(evt.peerAddress), dnaAddress, agentId)
            let chainId = this._intoChainId(dnaAddress, agentId)
            let chainDht = this._getDhtRef(chainId)
            // // Notify my Core of agent disconnection
            // this._ipcSend('json', {
            //   method: 'peerDisconnected',
            //   agentId
            // })
            chainDht.dropPeer(agentId)
          }
        }
        // bookdrop
        delete this._peerTracks[evt.peerAddress]
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
   * Might send some messages back and also
   * transcribe received message into a local IPC message.
   * @private
   */
  _handleP2pPublish (opt) {
    // log.t(this.me() + ' << ' + this.nick(opt.from) + ' - ' + opt.data.type)
    let peerTracks
    switch (opt.data.type) {
      case 'dnaDhtGossip':
        // log.t(this.me() + ' bundle =', opt.data.bundle)
        // send remoteGossipBundle to each agent that tracks this DNA
        for (const [agentId, dnaList] of this._agentTracks) {
          for (const dna of dnaList) {
            if (dna === opt.data.dnaAddress) {
              const chainId = this._intoChainId(opt.data.dnaAddress, agentId)
              this._getDhtRef(chainId).post(DhtEvent.remoteGossipBundle(opt.from, opt.data.bundle))
              break
            }
          }
        }
        return
      case 'gossipNewTrack':
        // Some peer is telling us its tracking a new DNA
        log.t(this.me() + ' @@@@ ' + ' new track', opt.data.agentId, opt.data.dnaAddress)
        // get peer's machineId
        peerTracks = this._getPeerRef(opt.from)
        if (peerTracks.size === 0) {
          log.w('received gossipNewTrack from unknown peer', this.nick(opt.from))
        }
        // Add peer to dnaDht if we also track the same DNA
        // (this will store agentId -> machineId)
        const peerHoldEvent = DhtEvent.peerHoldRequest(
          opt.data.agentId,
          this.toDnaPeerTransport(opt.from),
          Buffer.from('').toString('base64'),
          Date.now())
        // send peerHoldEvent to each agent that tracks this DNA
        for (const [agentId, dnaList] of this._agentTracks) {
          for (const dna of dnaList) {
            if (dna === opt.data.dnaAddress) {
              // dht.post(peerHoldEvent)
              const chainId = this._intoChainId(opt.data.dnaAddress, agentId)
              this._handleChainDhtEvent(peerHoldEvent, chainId)
              break
            }
          }
        }
        return
      case 'gossipAllTracks':
        // Some peer is telling us of all the DNA it is tracking
        // log.t(this.me() + ' << ' + this.nick(opt.from) + ' - gossipAllTracks', opt.data)
        // Bookkeep peer's machineId
        peerTracks = this._getPeerRef(opt.from)
        if (peerTracks.size === 0) {
          log.w(this.me() + ' received gossipAllTracks from unknown peer', this.nick(opt.from))
        }
        // Tell each tracked dnaDht to store peer's agentIds
        for (const [agentId, dnaAddress] of opt.data.dnaByAgent) {
          log.t(this.me() + ' @@@@ ' + this.me() + ' new track(s)', agentId, dnaAddress)
          // Store for this dnaDht: agentId -> machineId
          const peerHoldEvent = DhtEvent.peerHoldRequest(agentId, this.toDnaPeerTransport(opt.from), Buffer.from('').toString('base64'), Date.now())
          // send peerHoldEvent to each agent that tracks this DNA
          for (const [agentId, dnaList] of this._agentTracks) {
            for (const dna of dnaList) {
              if (dna === dnaAddress) {
                const chainId = this._intoChainId(dnaAddress, agentId)
                this._handleChainDhtEvent(peerHoldEvent, chainId)
                break
              }
            }
          }
        }
        return
      case 'handleSendMessage':
        log.t(this.me() + ' Received P2P handleSendMessage', opt.data)
        // Send error back to sender if we untracked this DNA
        if (!this._hasTrack(opt.data.toAgentId, opt.data.dnaAddress)) {
          log.e(this.me() + ' #### P2P hasTrack() failed for agent "' + opt.data.toAgentId + '" ; DNA = "' + opt.data.dnaAddress + '" ; ' + opt.data.fromAgentId)
          const chainId = this._intoChainId(opt.data.dnaAddress, opt.data.toAgentId)
          const mId = this._getMachineIdOrFail(chainId, opt.data.fromAgentId, opt.data._id)
          if (mId === null) {
            log.w('No known machineId for agent ' + opt.data.fromAgentId + ' in space ' + chainId)
            return
          }
          this._p2pSend(mId, {
            type: 'failureResult',
            dnaAddress: opt.data.dnaAddress,
            _id: opt.data._id,
            toAgentId: opt.data.fromAgentId,
            resultInfo: [...Buffer.from('Agent ' + opt.data.toAgentId + ' is not tracking DNA: ' + opt.data.dnaAddress)]
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
      case 'failureResult':
        // forward to Core
        this._ipcSend('json', {
          method: 'failureResult',
          _id: opt.data._id,
          dnaAddress: opt.data.dnaAddress,
          toAgentId: opt.data.toAgentId,
          resultInfo: opt.data.resultInfo
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
    log.t(this.me() + '_initDht', dnaAddress, agentId)
    // pre-conditions
    if (!dnaAddress || typeof dnaAddress !== 'string' || !dnaAddress.length) {
      throw new Error('cannot _initDht without dnaAddress string')
    }
    if (!agentId || typeof agentId !== 'string' || !agentId.length) {
      throw new Error('cannot _initDht without agentId string')
    }
    // Setup init data
    const dhtInitOptions = {
      thisPeer: DhtEvent.peerHoldRequest(
        agentId,
        this.toDnaPeerTransport(this._p2p.getId()),
        Buffer.from('self').toString('base64'),
        Date.now()
      ),
      name: this.nick(dnaAddress)
    }
    //
    const chainId = this._intoChainId(dnaAddress, agentId)
    // Construct
    let dht = (await new DhtFullSync2(dhtInitOptions)).interfaceDht
    // Set event handler
    dht.on('event', e => this._handleChainDhtEvent(e, chainId).catch(err => {
      console.error('Error while handling chainDhtEvent', e, err)
      process.exit(1)
    }))
    // Add to "Map"
    this._dhtPerChain[chainId] = dht
  }

  _getPeerList () {
    return Object.keys(this._peerTracks)
  }

  /**
   * @private
   */
  _getPeerRef (machineId) {
    if (!machineId || typeof machineId !== 'string' || !machineId.length) {
      throw new Error('_getPeerRef() call missing machineId string argument')
    }
    if (!(machineId in this._peerTracks)) {
      this._peerTracks[machineId] = new Map()
    }
    return this._peerTracks[machineId]
  }

  /**
   * @private
   * FIXME
   */
  _getDhtRef (chainId) {
    if (!chainId || typeof chainId !== 'string' || !chainId.length) {
      throw new Error('_getDhtRef() call missing chainId string argument')
    }
    if (!(chainId in this._dhtPerChain)) {
      log.w('Unknown or untracked chain: ' + chainId)
      return
    }
    return this._dhtPerChain[chainId]
  }

  /**
   * @private
   */
  _getMemRef (chainId) {
    if (!(chainId in this._memory)) {
      const mem = new RealMem()
      mem.registerIndexer((store, data) => {
        if (data && data.type === 'entryAspect') {
          log.t(this.me() + ' got entryAspect', data)
          const encodedAspect = Buffer.from(JSON.stringify(data.aspect)).toString('base64')

          // Notify our chainDHT that we have that aspect
          this._getDhtRef(chainId).post(DhtEvent.dataHoldRequest(data.entryAddress, [encodedAspect]))
          // and tell it to broadcast it
          const encodedEntry = Buffer.from(JSON.stringify(data)).toString('base64')
          this._getDhtRef(chainId).post(DhtEvent.dataBroadcast(data.entryAddress, encodedEntry))

          // Tell Core to store it if it isn't already holding it
          if (this._hasEntryAspect(chainId, data.entryAddress, data.aspectAddress)) {
            log.t(this.me() + ' entryAspect is known:', data.aspectAddress)
            return
          }
          // log.t(this.me() + ' dhtEntry is unknown', data.aspectAddress)
          // bookkeep
          this._bookkeepAspect(this._storedEntryBook, chainId, data.entryAddress, data.aspectAddress)
          log.t(this.me() + ' _storedEntryBook: ' + data.aspectAddress + ' | ' + JSON.stringify(this._storedEntryBook))
          // Tell Core to store it
          log.t(this.me() + ' Sending IPC handleStoreEntryAspect: ', data.entryAddress, data.aspect)
          const storeMsg = {
            method: 'handleStoreEntryAspect',
            _id: this._generateRequestId(),
            dnaAddress: this._deconstructChainId(chainId)[0],
            providerAgentId: data.providerAgentId,
            entryAddress: data.entryAddress,
            entryAspect: data.aspect
          }
          this._ipcSend('json', storeMsg)
        }
      })
      this._memory[chainId] = mem
    }
    return this._memory[chainId]
  }

  /**
   *  Get machineId of an agent in a Dna space. Agents must be tracking that Dna.
   *  If not, will try to send a FailureResult back to sender (if sender info is provided).
   *  Returns peerAddress of receiverAgentId if agent is tracking dna.
   *  @private
   *  FIXME
   */
  _getMachineIdOrFail (chainId, receiverAgentId, requestId) {
    const chainDht = this._getDhtRef(chainId)
    if (chainDht === undefined || !chainDht.getPeerLocal(receiverAgentId)) {
      // Send FailureResult back to IPC, should be senderAgentId
      log.e(this.me() + ' #### ERR - Failed finding (agent) "' + receiverAgentId + '" + in (chainId) "' + chainId)
      this._ipcSend('json', {
        method: 'failureResult',
        dnaAddress: this._deconstructChainId(chainId)[0],
        _id: requestId,
        toAgentId: this._deconstructChainId(chainId)[1],
        resultInfo: [...Buffer.from('No routing found for agent id "' + receiverAgentId + '"')]
      })
      return null
    }
    const recvPeer = chainDht.getPeerLocal(receiverAgentId)
    const recvPeerAddress = this.toMachineId(recvPeer.peerTransport)
    log.t(this.me() + ' oooo OK - Found (agent) "' + receiverAgentId + '" + (chainId) ' + chainId)
    return recvPeerAddress
  }

  /**
   * @private
   */
  async _untrack (dnaAddress, agentId) {
    log.t(this.me() + ' _untrack() for "' + agentId + '" for DNA "' + dnaAddress + '"')
    this._removeTrack(agentId, dnaAddress)
    const chainId = this._intoChainId(dnaAddress, agentId)
    if (chainId in this._dhtPerChain) {
      let dht = this._dhtPerChain[chainId]
      delete this._dhtPerChain[chainId]
      await dht.destroy()
    }
  }

  /**
   * @private
   */
  async _track (dnaAddress, agentId) {
    log.t(this.me() + ' _track', dnaAddress, agentId)
    if (this._hasTrack(agentId, dnaAddress)) {
      log.w(this.me() + agentId + ' already tracking ' + dnaAddress)
      return
    }
    // Bookkeep agentId -> dnaAddress
    this._addTrack(agentId, dnaAddress)
    const chainId = this._intoChainId(dnaAddress, agentId)
    // Init DHT for this DNA+Agent and book-keep agentId -> peerAddress for self
    if (chainId in this._dhtPerChain) {
      log.w(this.me() + 'Already have chainDHT for ' + chainId)
      return
    }
    await this._initDht(dnaAddress, agentId)

    // Make sure thisPeer data is stored
    const dht = this._getDhtRef(chainId)
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
      method: 'handleGetAuthoringEntryList',
      dnaAddress,
      providerAgentId: agentId,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipcSend('json', {
      method: 'handleGetGossipingEntryList',
      dnaAddress,
      providerAgentId: agentId,
      _id: requestId
    })
  }
}

exports.N3hRealMode = N3hRealMode
