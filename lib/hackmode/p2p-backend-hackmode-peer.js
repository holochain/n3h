const { AsyncClass, Track } = require('../n3h-common')
const { KeyBundle } = require('../hc-dpki')
const mosodium = require('../mosodium')
const tweetlog = require('../tweetlog')
const log = tweetlog('p2p-backend')

const { URL } = require('url')
const msgpack = require('msgpack-lite')

const timeoutRegex = /Error: timeout/

const {
  Connection,
  Dht,
  DhtEvent,
  P2pEvent
} = require('../n3h-mod-spec')

const { ConnectionBackendWss } = require('../n3h-mod-connection-wss')
const { DhtBackendFullsync } = require('../n3h-mod-dht-fullsync')

/**
 * @param {object} options
 * @param {object} options.dht
 * @param {object} options.connection
 * @param {array<string>} [options.connection.bind] - local ports to bind
 * @param {string} [options.wssAdvertise] - if set, advertise this node as directly connectable on a wss port. if the special string "auto" is supplied, use the equivalent of `getBindings().next().value` as the address.
 * @param {string} [options.wssRelayPeer] - if set, advertise this node as relaying through a specific peer target at this peerTransport address. must be a direct address, not another relay.
 */
class P2pBackendHackmodePeer extends AsyncClass {
  /**
   */
  async init (spec, initOptions) {
    await super.init()

    this._spec = spec

    // Init fields
    this._newConTrack = await new Track()
    this._bindings = new Set()
    // Map of connection -> PeerAddress
    this._conByPeerAddress = new Map()

    let seed = null

    // HACK - if we have a wss advertise, hash it and use as transport id seed
    // to achieve a static id until persistence is available
    if (
      typeof initOptions.wssAdvertise === 'string' &&
      initOptions.wssAdvertise !== 'auto'
    ) {
      log.i('generating transport id seed from wssAdvertise hash')
      seed = mosodium.hash.sha256(Buffer.from(initOptions.wssAdvertise))
      seed = mosodium.SecBuf.from(seed)
    } else {
      // Create ID with a a random KeyBundle
      log.i('generating transport id seed randomly')
      seed = new mosodium.SecBuf(32)
      seed.randomize()
    }

    this._keyBundle = await KeyBundle.newFromSeed(seed)
    log.i('peerId:', this._keyBundle.getId())

    // Create Connection
    this._con = await new Connection(ConnectionBackendWss, initOptions.connection)
    this._con.on('event', e => this._handleConEvent(e).catch(err => {
      console.error('Handle Connection Event Error', e, err)
      process.exit(1)
    }))
    // Bind connections
    const bind = Array.isArray(initOptions.connection.bind)
      ? initOptions.connection.bind
      : []
    await Promise.all(bind.map(b => this._con.bind(b)))

    // Init _wssAdvertise & bootstrapPeer
    this._wssAdvertise = null
    let bootstrapPeer = null
    if (typeof initOptions.wssAdvertise === 'string') {
      let uri = initOptions.wssAdvertise
      if (uri === 'auto') {
        uri = this.getBindings().next().value
      }
      this._advertise(uri)
    } else if (Array.isArray(initOptions.wssRelayPeers) && initOptions.wssRelayPeers.length) {
      bootstrapPeer = initOptions.wssRelayPeers[0]
      if (initOptions.wssRelayPeers.length > 1) {
        throw new Error('multiple relay peers unimplemented')
      }
      const url = new URL(bootstrapPeer)
      if (url.protocol !== 'wss:') {
        throw new Error('can only relay through a direct wss: peer, not ' + url.protocol)
      }
      if (!url.searchParams.has('a')) {
        throw new Error('invalid wssRelayPeer, no "a" param found on search string')
      }
      this._advertise('holorelay://' + url.searchParams.get('a'))
    } else {
      throw new Error('required either wssAdvertise or wssRelayPeers')
    }

    // Init Peer Discovery DHT
    initOptions.dht.thisPeer = this._wssAdvertise
    this._dht = await new Dht(DhtBackendFullsync, initOptions.dht)
    this._dht.on('event', e => this._handleDhtEvent(e).catch(err => {
      console.error('Handle Dht Event Error', e, err)
      process.exit(1)
    }))

    // Set Destructor
    this.$pushDestructor(async () => {
      await this._newConTrack.destroy()
      await this._con.destroy()
      await this._dht.destroy()
      await this._keyBundle.destroy()

      this._conByPeerAddress.clear()
      this._conByPeerAddress = null

      this._bindings.clear()
      this._bindings = null
    })

    // Connect to bootstrapPeer
    if (bootstrapPeer) {
      await this.transportConnect(bootstrapPeer)
    }
  }

  // -- Getters -- //

  /**
   */
  getId () {
    return this._keyBundle.getId()
  }

  /**
   */
  getBindings () {
    return this._bindings.values()
  }

  /**
   */
  getAdvertise () {
    return this._wssAdvertise.peerTransport +
      '?a=' + this._wssAdvertise.peerAddress
  }

  // -- Public Connection API -- //

  /**
   */
  async transportConnect (remoteAdvertise) {
    await this._ensureConnection(remoteAdvertise)
  }

  /**
   * a soft close request... lib may comply, but may immediately connect again
   */
  async close (peerAddress) {
    if (this._conByPeerAddress.has(peerAddress)) {
      const cId = this._conByPeerAddress.get(peerAddress)
      await this._con.close(cId)
    }
  }

  /**
   * Publish encrypted data to a known list of peers?
   */
  async publishReliable (peerAddressList, data) {
    return this._publish(
      null, // no need for a msgId
      this._keyBundle.getId(), // peerAddress is peer's pub key
      peerAddressList,
      '$publish$', // send p2p message of type 'publish'
      Buffer.from(data, 'base64')
    )
  }

  /**
   */
  async publishUnreliable (peerAddressList, data) {
    // todo - ignore address resolution misses here
    return this.publishReliable(peerAddressList, data)
  }

  /**
   * Request some data?
   */
  async requestReliable (msgId, peerAddressList, data) {
    return this._publish(
      msgId, this._keyBundle.getId(), peerAddressList, '$request$',
      Buffer.from(data, 'base64')
    )
  }

  /**
   * Respond to a data request?
   */
  async respondReliable (msgId, peerAddress, data) {
    return this._publish(
      msgId, this._keyBundle.getId(), [peerAddress], '$response$',
      Buffer.from(data, 'base64')
    )
  }

  // -- private -- //

  /**
   * send a message to several peers on the network
   */
  async _publish (msgId, fromPeerAddress, peerAddressList, type, data) {
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer')
    }
    // Connect to all provided peers
    
    let cIds = await Promise.all(peerAddressList.map(
      a => this._ensureCIdForPeerAddress(a).catch(e => {
        if (!timeoutRegex.test(e)) {
          console.error('@@ fixme publish error catch @@', e)
        }
      })))

    // Filter for valid cIds and exit if there are none
    cIds = cIds.filter(cId => cId !== undefined)
    if (cIds.length === 0) {
      // log.i('Skipping publish because no connections to peers')
      return
    }

    // Send to all peers
    return this._sendByCId(
      cIds, msgId, fromPeerAddress, peerAddressList, type, data)
  }

  /**
   * Send a message through a ConnectionId
   */
  async _sendByCId (cIdList, msgId, fromPeerAddress, peerAddressList, type, data) {
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer')
    }
    return this._con.send(cIdList, msgpack.encode([
      msgId, fromPeerAddress, peerAddressList, type, data]).toString('base64'))
  }

  /**
   * (called by this.transportConnect() and this._ensureCIdForPeerAddress())
   */
  async _ensureConnection (remoteAdvertise) {
    // get uri and PeerId
    const uri = new URL(remoteAdvertise)
    if (!uri.searchParams.has('a')) {
      throw new Error('cannot connect to peer without nodeId ("a" param)')
    }
    const remotePeerId = uri.searchParams.get('a')
    // short circuit if we already have a connection for this peer
    if (this._conByPeerAddress.has(remotePeerId)) {
      return this._conByPeerAddress.get(remotePeerId)
    }
    // short circuit if we are already TRYING to connect to this peer
    if (this._newConTrack.has(remotePeerId)) {
      return this._newConTrack.get(remotePeerId)
    }
    // Try to connect
    const promise = this._newConTrack.track(remotePeerId)

    promise.catch(err => {
      if (!timeoutRegex.test(err)) {
        console.error('@@ fixme connection error catch @@', err)
      }
    })

    await this._con.connect(uri.href)
    return promise
  }

  /**
   * (Called by _publish())
   */
  async _ensureCIdForPeerAddress (peerAddress) {
    // Return connection for this Peer if exists
    if (this._conByPeerAddress.has(peerAddress)) {
      return this._conByPeerAddress.get(peerAddress)
    }
    // Connect to the peer via DHT
    const peer = await this._dht.fetchPeer(peerAddress)
    if (!peer) {
      throw new Error('could not connect to peer ' + peerAddress)
    }

    const uri = new URL(peer.peerTransport)

    switch (uri.protocol) {
      case 'wss:':
        return this._ensureConnection(
          peer.peerTransport + '?a=' + peer.peerAddress)
      case 'holorelay:':
        return this._ensureCIdForPeerAddress(uri.hostname)
      default:
        throw new Error('unhandled peerTransport protocol ' + uri.protocol)
    }
  }

  /**
   * Set my own Peer info in _wssAdvertise
   */
  _advertise (uri) {
    this._wssAdvertise = DhtEvent.peerHoldRequest(
      this._keyBundle.getId(),
      uri,
      Buffer.alloc(0).toString('base64'),
      Date.now()
    )
  }

  /**
   * Return a peerId in a log friendly format
   */
  _nick (peerId) {
    return '(' + peerId.substring(2, 6) + ')'
  }

  /**
   * Return my peerId in a log friendly format
   */
  _me () {
    return this._nick(this.getId())
  }

  /**
   *
   */
  async _handleDhtEvent (e) {
    // log.t(this._me() + '._p2p._handleDhtEvent()', e.type)
    // Handle event by type
    switch (e.type) {
      case 'gossipTo':
        await this._publish(
          null,
          this._keyBundle.getId(),
          e.peerList,
          '$gossip$',
          Buffer.from(e.bundle, 'base64')
        )
        break
      case 'peerHoldRequest':
        // no validation / indexing for now,
        // just pass it back in
        this._dht.post(e)
        break
      default:
        throw new Error('unhandled dht event type ' + e.type + ' ' + JSON.stringify(e))
    }
  }

  /**
   */
  async _handleConEvent (e) {
    switch (e.type) {
      case 'bind':
        e.boundUriList.forEach(b => this._addBinding(b))
        break
      case 'connection':
      case 'connect':
        await this._addConnection(e.id)
        break
      case 'message':
        await this._handleMessage(e.id, e.buffer)
        break
      case 'close':
        await this._removeConnection(e.id, e.data)
        break
      case 'error':
        console.error(e)
        break
      case 'conError':
        console.error(e)
        break
      default:
        throw new Error('unhandled con event type ' + e.type + ' ' + JSON.stringify(e))
    }
  }

  /**
   */
  _addBinding (binding) {
    this._bindings.add(binding)
  }

  /**
   */
  async _addConnection (cId) {
    return this._sendByCId(
      [cId], null, this._keyBundle.getId(), [], '$advertise$',
      msgpack.encode(this._wssAdvertise)
    )
  }

  /**
   */
  async _removeConnection (connectionId) {
    for (let [peerAddress, cId] of this._conByPeerAddress) {
      if (connectionId === cId) {
        log.t(this._me() + 'removing connection', peerAddress)
        this._conByPeerAddress.delete(peerAddress)
      }
    }
  }

  /**
   * Handle message from the network (sent by _send())
   */
  async _handleMessage (cId, data) {
    // Decode and "unpack" data
    data = msgpack.decode(Buffer.from(data, 'base64'))
    if (!Array.isArray(data) || data.length !== 5) {
      throw new Error('unexpected protocol data' + JSON.stringify(data))
    }
    const msgId = data[0]
    const fromPeerAddress = data[1]
    const peerAddressList = data[2]
    const type = data[3]
    const message = data[4]

    // if peerAddressList is not empty, then we need to make sure
    // we are the destination. If not, we must forward to the correct nodes
    if (peerAddressList.length) {
      let isForUs = false
      for (let a of peerAddressList) {
        if (a === this._keyBundle.getId()) {
          isForUs = true
          break
        }
      }
      if (!isForUs) {
        return this._publish(
          msgId, fromPeerAddress, peerAddressList, type, message)
      }
    }

    // Handle p2p message by type
    switch (type) {
      case '$advertise$':
        // Resolve Connection request
        const rem = msgpack.decode(message)
        log.t(this._me() + '._p2p._handleMessage(): $advertise$', this._nick(rem.peerAddress), rem.peerTransport, rem.peerData)
        this._conByPeerAddress.set(rem.peerAddress, cId)
        this._con.setMeta(cId, rem)
        this._newConTrack.resolve(rem.peerAddress, cId)
        await this._dht.post(DhtEvent.peerHoldRequest(
          rem.peerAddress,
          rem.peerTransport,
          rem.peerData,
          rem.peerTs
        ))
        // Send back peerConnect event to sender
        await this._spec.$emitEvent(P2pEvent.peerConnect(rem.peerAddress))
        break
      case '$gossip$':
        await this._dht.post(DhtEvent.remoteGossipBundle(
          fromPeerAddress, message.toString('base64')))
        break
      case '$publish$':
        await this._spec.$emitEvent(P2pEvent.handlePublish(
          fromPeerAddress, message.toString('base64')
        ))
        break
      case '$request$':
        await this._spec.$emitEvent(P2pEvent.handleRequest(
          fromPeerAddress, msgId, message.toString('base64')
        ))
        break
      case '$response$':
        await this._spec.$checkResolveRequest(P2pEvent.handleRequest(
          fromPeerAddress, msgId, message.toString('base64')
        ))
        break
      default:
        throw new Error('unexpected protocol message type ' + type)
    }
  }
}

exports.P2pBackendHackmodePeer = P2pBackendHackmodePeer
