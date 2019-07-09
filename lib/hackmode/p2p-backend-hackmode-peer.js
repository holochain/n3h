const { AsyncClass, Track } = require('../n3h-common')
const { KeyBundle } = require('../hc-dpki')
const mosodium = require('../mosodium')
const tweetlog = require('../tweetlog')
const log = tweetlog('p2p-backend')

const { URL } = require('url')
const msgpack = require('msgpack-lite')

const timeoutRegex = /Error: timeout/

const {
  P2p,
  P2pEvent,
  DhtEvent
} = require('../interface')

const { ConnectionBackendWss } = require('../n3h-mod-connection-wss')
const { DhtFullSync2 } = require('../n3h-mod-dht-fullsync')

const fs = require('fs')
const path = require('path')

const FAKE_PASSPHRASE = Buffer.from('hackmode_passphrase')
const KEY_FILENAME = 'machineId.keyfile'

/**
 * Hackmode implementation of the p2p spec
 */
class P2pBackendHackmodePeer extends AsyncClass {
  /**
   * @param {object} spec - Owner
   * @param {object} initOptions -  Initialization settings for the P2p backend
   * @param {object} initOptions.dht - DHT settings
   * @param {object} initOptions.connection - Connection settings
   * @param {array<string>} [initOptions.connection.bind] - local ports to bind
   * @param {string} [initOptions.wssAdvertise] - if set, advertise this node as directly connectable on a wss port.
   * if the special string "auto" is supplied, use the equivalent of `getBindings().next().value` as the address.
   * @param {string} [initOptions.wssRelayPeer] - if set, advertise this node as relaying through a specific peer target
   * at this peerTransport address. must be a direct address, not another relay.
   */
  async init (initOptions) {
    await super.init()

    this.interfaceP2p = this._iface = await new P2p(this)

    // Init fields
    this._newConTrack = await new Track()
    this._bindings = new Set()
    // Map of connection -> PeerAddress
    this._conByPeerAddress = new Map()

    if (initOptions.useTransientTransportId) {
      this._keyBundle = await this._genKey()
    } else {
      // load key from persistency folder
      this._keyBundle = await this._loadKey(initOptions.workDir)
    }
    log.i('machineId:', this._keyBundle.getId())

    // Create Connection
    this._con = (await new ConnectionBackendWss(initOptions.connection)).connectionInterface
    this._con.on('event', e => this._handleConEvent(e).catch(err => {
      console.error('Handle Connection Event Error', e, err)
      process.exit(1)
    }))
    // Bind connections
    const bind = Array.isArray(initOptions.connection.bind)
      ? initOptions.connection.bind
      : []
    await Promise.all(bind.map(b => this._con.bind(b)))

    // Init _myPeerInfo & bootstrapRelayPeer
    this._myPeerInfo = null
    let bootstrapRelayPeer = null
    if (typeof initOptions.wssAdvertise === 'string') {
      let uri = initOptions.wssAdvertise
      if (uri === 'auto') {
        uri = this.getBindings().next().value
      }
      this._setPeerInfo(uri)
    } else if (Array.isArray(initOptions.wssRelayPeers) && initOptions.wssRelayPeers.length) {
      bootstrapRelayPeer = initOptions.wssRelayPeers[0]
      if (initOptions.wssRelayPeers.length > 1) {
        throw new Error('multiple relay peers unimplemented')
      }
      const url = new URL(bootstrapRelayPeer)
      if (url.protocol !== 'wss:') {
        throw new Error('can only relay through a direct wss: peer, not ' + url.protocol)
      }
      if (!url.searchParams.has('a')) {
        throw new Error('invalid wssRelayPeer, no "a" param found on search string')
      }
      this._setPeerInfo('holorelay://' + url.searchParams.get('a'))
    } else {
      throw new Error('required either wssAdvertise or wssRelayPeers')
    }

    // Init Peer Discovery DHT, e.g. transportDht
    initOptions.dht.thisPeer = this._myPeerInfo
    initOptions.dht.name = '(p2p)'
    this._dht = (await new DhtFullSync2(initOptions.dht)).interfaceDht
    this._dht.on('event', e => this._handleDhtEvent(e).catch(err => {
      console.error('Error while handling transportDhtEvent', e, err)
      process.exit(1)
    }))

    // Set Destructor
    this.$pushDestructor(async () => {
      await this._iface.destroy()
      this.interfaceP2p = null
      this._iface = null
      await this._newConTrack.destroy()
      await this._con.destroy()
      await this._dht.destroy()
      await this._keyBundle.destroy()

      this._conByPeerAddress.clear()
      this._conByPeerAddress = null

      this._bindings.clear()
      this._bindings = null
    })

    // Connect to bootstrapRelayPeer
    if (bootstrapRelayPeer) {
      await this.transportConnect(bootstrapRelayPeer)
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
    return this._myPeerInfo.peerTransport +
      '?a=' + this._myPeerInfo.peerAddress
  }

  // -- Public Connection API -- //

  /**
   */
  async transportConnect (remoteAdvertise) {
    return this._ensureConnection(remoteAdvertise)
  }

  /**
   * a soft close request... lib may comply, but may immediately connect again
   */
  async close (peerAddress) {
    if (this._conByPeerAddress.has(peerAddress)) {
      const cId = this._conByPeerAddress.get(peerAddress)
      this._conByPeerAddress.delete(peerAddress)
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
    const results = await Promise.all(peerAddressList.map(
      a => this._ensureCIdForPeerAddress(a).catch(e => {
        if (!timeoutRegex.test(e)) {
          console.error('@@ fixme publish error catch @@', e)
        }
        return null
      })))

    // Filter for valid cIds and exit if there are none
    let cIds = results.filter(r => r && r.cId).map(r => r.cId)
    if (cIds.length === 0) {
      // log.i('Skipping publish because no connections to peers')
      return
    }

    // Send to all connected peers
    return this._sendByCId(cIds, msgId, fromPeerAddress, peerAddressList, type, data)
  }

  /**
   * Send a message to the specified Connections
   * @param {array} cIdList - List of ConnectionIds to send the message to
   * @param msgId - Optional message Id
   * @param fromPeerAddress - Specify from which Peer the message is from
   * @param {[String]} peerAddressList - Specify if message is for specific peers only (empty array means for all peers on those Connections)
   * @param type of ConnectionMessage sent
   * @param data
   * @private
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
    // unpack peerAddress from advertise
    const uri = new URL(remoteAdvertise)
    if (!uri.searchParams.has('a')) {
      throw new Error('cannot connect to peer without peerAddress ("a" param)')
    }
    const remotePeerAddress = uri.searchParams.get('a')
    // Must be a different id
    if (remotePeerAddress === this.getId()) {
      throw new Error('Cannot connect to a peer with the same peerAddress: ' + remotePeerAddress)
    }
    // short circuit if we already have a connection for this peer
    if (this._conByPeerAddress.has(remotePeerAddress)) {
      return {
        cId: this._conByPeerAddress.get(remotePeerAddress),
        isNew: false
      }
    }
    // short circuit if we are already TRYING to connect to this peer
    if (this._newConTrack.has(remotePeerAddress)) {
      return {
        cId: (await this._newConTrack.get(remotePeerAddress)).cId,
        isNew: false
      }
    }
    // Try to connect
    const promise = this._newConTrack.track(remotePeerAddress)

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
    if (peerAddress === this.getId()) {
      throw new Error('messaging self, please shortcut')
    }

    // Return connection for this Peer if exists
    if (this._conByPeerAddress.has(peerAddress)) {
      return {
        cId: this._conByPeerAddress.get(peerAddress),
        isNew: false
      }
    }
    // Connect to the peer via DHT
    const peerInfo = await this._dht.fetchPeer(peerAddress)
    if (!peerInfo) {
      throw new Error('could not connect to peer ' + peerAddress)
    }

    const uri = new URL(peerInfo.peerTransport)

    switch (uri.protocol) {
      case 'wss:':
        const remotePeerAddress = peerInfo.peerTransport +
          '?a=' + peerInfo.peerAddress
        return this._ensureConnection(remotePeerAddress)
      case 'holorelay:':
        return this._ensureCIdForPeerAddress(uri.hostname)
      default:
        throw new Error('unhandled peerTransport protocol ' + uri.protocol)
    }
  }

  /**
   * Set my own peer info in _myPeerInfo
   */
  _setPeerInfo (uri) {
    this._myPeerInfo = DhtEvent.peerHoldRequest(
      this._keyBundle.getId(),
      uri,
      Buffer.alloc(0).toString('base64'),
      Date.now()
    )
  }

  /**
   * Return a peerAddress in a log friendly format
   */
  _nick (peerAddress) {
    return '(' + peerAddress.substring(2, 6) + ')'
  }

  /**
   * Return my peerAddress in a log friendly format
   */
  _me () {
    return this._nick(this.getId())
  }

  /**
   * Handle event our _dht sent us
   */
  async _handleDhtEvent (e) {
    // log.t(this._me() + '._p2p._handleDhtEvent()', e.type)
    // Handle event by type
    switch (e.type) {
      // our _dht wants us to gossip something to some peers
      case 'gossipTo':
        try {
          await this._publish(
            null,
            this._keyBundle.getId(),
            e.peerList,
            '$gossip$',
            Buffer.from(e.bundle, 'base64')
          )
        } catch (e) {
          log.w('gossip failed, connection drop?', e)
        }
        break
      case 'peerHoldRequest':
        // log.t(this._me() + '._p2p.peerHoldRequest:', e)
        // no validation / indexing for now,
        // just pass it back in
        this._dht.post(e)
        break
      case 'peerTimedOut':
        log.t(this._me() + '.peerTimedOut:', e)
        // Notify owner of peer disconnection
        await this._iface.$emitEvent(P2pEvent.peerDisconnect(e.peerAddress))
        break
      default:
        throw new Error('unhandled dht event type ' + e.type + ' ' + JSON.stringify(e))
    }
  }

  /**
   * Handle event our _con sent us (wss)
   */
  async _handleConEvent (e) {
    // log.t(this._me() + '._p2p._handleConEvent()', e.type)
    switch (e.type) {
      case 'bind':
        e.boundUriList.forEach(b => this._addBinding(b))
        break
      // Our own connection attempt succeeded
      case 'connection':
      case 'connect':
        // log.t(this._me() + '._p2p.connect:', e)
        await this._addConnection(e.id)
        break
      // message received from the network
      case 'message':
        await this._handleMessage(e.id, e.buffer)
        break
      case 'close':
        await this._removeConnection(e.id)
        break
      case 'error':
        console.error(e)
        break
      case 'conError':
        console.error(e)
        await this._removeConnection(e.id)
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
      msgpack.encode(this._myPeerInfo)
    )
  }

  /**
   */
  async _removeConnection (connectionId) {
    for (let [peerAddress, cId] of this._conByPeerAddress) {
      if (connectionId === cId) {
        log.t(this._me() + ' Removing connection to', this._nick(peerAddress))
        this.close(peerAddress)
      }
    }
  }

  /**
   * Handle message received from the network (sent by other's _send())
   * or from ourself.
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

    // if peerAddressList is not empty, then we need to make sure we are the destination.
    // If not, we must forward to the correct nodes
    if (peerAddressList.length) {
      let isForUs = false
      for (let a of peerAddressList) {
        if (a === this._keyBundle.getId()) {
          isForUs = true
          break
        }
      }
      if (!isForUs) {
        // forward message
        return this._publish(
          msgId, fromPeerAddress, peerAddressList, type, message)
      }
    }

    // Handle received p2p message by type
    switch (type) {
      case '$advertise$':
        // Someone wants to connect with us or we connected to someone
        // Resolve Connection request
        let remotePeerInfo = msgpack.decode(message)
        // log.t(this._me() + '._handleMessage(): $advertise$', this._nick(remotePeerInfo.peerAddress), remotePeerInfo.peerTransport, remotePeerInfo.peerData)
        log.t(this._me() + ' Adding connection', this._nick(remotePeerInfo.peerAddress))
        this._conByPeerAddress.set(remotePeerInfo.peerAddress, cId)
        this._con.setMeta(cId, remotePeerInfo)
        this._newConTrack.resolve(remotePeerInfo.peerAddress, {
          cId,
          isNew: true
        })
        await this._dht.post(DhtEvent.peerHoldRequest(
          remotePeerInfo.peerAddress,
          remotePeerInfo.peerTransport,
          remotePeerInfo.peerData,
          Date.now()
        ))
        // Notify owner of peer connection
        await this._iface.$emitEvent(P2pEvent.peerConnect(remotePeerInfo.peerAddress))
        break
      case '$gossip$':
        await this._dht.post(DhtEvent.remoteGossipBundle(
          fromPeerAddress, message.toString('base64')))
        break
      case '$publish$':
        await this._iface.$emitEvent(P2pEvent.handlePublish(
          fromPeerAddress, message.toString('base64')
        ))
        break
      case '$request$':
        await this._iface.$emitEvent(P2pEvent.handleRequest(
          fromPeerAddress, msgId, message.toString('base64')
        ))
        break
      case '$response$':
        await this._iface.$checkResolveRequest(P2pEvent.handleRequest(
          fromPeerAddress, msgId, message.toString('base64')
        ))
        break
      default:
        throw new Error('unexpected protocol message type ' + type)
    }
  }

  /**
   */
  async _genKey () {
    const seed = await mosodium.SecBuf.secure(mosodium.sign.SEED_BYTES)
    await seed.randomize()
    return KeyBundle.newFromSeed(seed)
  }

  /**
   * @param {String} workDir - Directory where to search for the keyfile
   * @returns {keyBundle} KeyBundle loaded from disk or randomly generated and saved to disk
   */
  async _loadKey (workDir) {
    let bundle = null
    try {
      bundle = await this._loadKeyFromDisk(workDir)
      log.i('loadKeyFromDisk success -', bundle.getId())
    } catch (err) {
      log.w('loadKeyFromDisk failed - Generating a new transport keyBundle')
      // Generate new machineId with a random seed
      bundle = await this._genKey()
      // Persist new key
      let blob = await bundle.getBlob(FAKE_PASSPHRASE, 'machineId')
      blob = JSON.stringify(blob)
      try {
        const keyfilepath = path.resolve(workDir, KEY_FILENAME)
        fs.writeFileSync(keyfilepath, blob)
      } catch (err) {
        log.w('Writing keyfile to disk failed - ', err)
      }
    }
    return bundle
  }

  /**
   * Attempt to load a keyfile from disk
   * @param workDir - Directory where to search for the keyfile
   */
  async _loadKeyFromDisk (workDir) {
    if (!workDir) {
      throw new Error('missing workDir argument')
    }
    log.t('loadKeyFromDisk - workDir:', workDir)
    const keyfilepath = path.resolve(workDir, KEY_FILENAME)
    let blob = fs.readFileSync(keyfilepath)
    blob = JSON.parse(blob)
    blob.data = Buffer.from(blob.data, 'base64')
    return KeyBundle.fromBlob(blob, await mosodium.SecBuf.ref(FAKE_PASSPHRASE))
  }
}

exports.P2pBackendHackmodePeer = P2pBackendHackmodePeer
