const { AsyncClass, Track } = require('@holochain/n3h-common')
const { Keypair } = require('@holochain/hc-dpki')
const mosodium = require('@holochain/mosodium')
const { URL } = require('url')
const msgpack = require('msgpack-lite')

const {
  Connection,
  Dht,
  DhtEvent,
  P2pEvent
} = require('@holochain/n3h-mod-spec')

const { ConnectionBackendWss } = require('@holochain/n3h-mod-connection-wss')
const { DhtBackendFullsync } = require('@holochain/n3h-mod-dht-fullsync')

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

    const seed = new mosodium.SecBuf(32)
    seed.randomize()

    this._keypair = await Keypair.newFromSeed(seed)
    console.log('== node id ==')
    console.log(this._keypair.getId())
    console.log('== end node id ==')

    this._newConTrack = await new Track()
    this._bindings = new Set()

    this._conByPeerAddress = new Map()

    this._con = await new Connection(ConnectionBackendWss, initOptions.connection)

    this._con.on('event', e => this._handleConEvent(e).catch(err => {
      console.error('Handle Connection Event Error', e, err)
      process.exit(1)
    }))

    const bind = Array.isArray(initOptions.connection.bind)
      ? initOptions.connection.bind
      : []

    await Promise.all(bind.map(b => this._con.bind(b)))

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

    initOptions.dht.thisPeer = this._wssAdvertise

    this._dht = await new Dht(DhtBackendFullsync, initOptions.dht)
    this._dht.on('event', e => this._handleDhtEvent(e).catch(err => {
      console.error('Handle Dht Event Error', e, err)
      process.exit(1)
    }))

    this.$pushDestructor(async () => {
      await this._newConTrack.destroy()
      await this._con.destroy()
      await this._dht.destroy()
      await this._keypair.destroy()

      this._conByPeerAddress.clear()
      this._conByPeerAddress = null

      this._bindings.clear()
      this._bindings = null
    })

    if (bootstrapPeer) {
      await this.transportConnect(bootstrapPeer)
    }
  }

  /**
   */
  getId () {
    return this._keypair.getId()
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

  /**
   */
  async transportConnect (peerTransport) {
    await this._ensureConnection(peerTransport)
  }

  /**
   */
  async publishReliable (peerAddressList, data) {
    return this._publish(
      null, this._keypair.getId(), peerAddressList, '$publish$',
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
   */
  async requestReliable (msgId, peerAddressList, data) {
    return this._publish(
      msgId, this._keypair.getId(), peerAddressList, '$request$',
      Buffer.from(data, 'base64')
    )
  }

  /**
   */
  async respondReliable (msgId, peerAddress, data) {
    return this._publish(
      msgId, this._keypair.getId(), [peerAddress], '$response$',
      Buffer.from(data, 'base64')
    )
  }

  // -- private -- //

  /**
   */
  async _publish (msgId, fromPeerAddress, peerAddressList, type, data) {
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer')
    }

    const cIds = await Promise.all(peerAddressList.map(
      a => this._ensureCIdForPeerAddress(a)))

    return this._sendByCId(
      cIds, msgId, fromPeerAddress, peerAddressList, type, data)
  }

  /**
   */
  async _sendByCId (
    cIdList, msgId, fromPeerAddress, peerAddressList, type, data
  ) {
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer')
    }
    return this._con.send(cIdList, msgpack.encode([
      msgId, fromPeerAddress, peerAddressList, type, data]).toString('base64'))
  }

  /**
   */
  async _ensureConnection (peerTransport) {
    const uri = new URL(peerTransport)

    if (!uri.searchParams.has('a')) {
      throw new Error('cannot connect to peer without nodeId ("a" param)')
    }
    const remId = uri.searchParams.get('a')

    // short circuit if we already have a connection
    if (this._conByPeerAddress.has(remId)) {
      return this._conByPeerAddress.get(remId)
    }

    if (this._newConTrack.has(remId)) {
      return this._newConTrack.get(remId)
    }

    const promise = this._newConTrack.track(remId)

    await this._con.connect(uri)

    return promise
  }

  /**
   */
  async _ensureCIdForPeerAddress (peerAddress) {
    if (this._conByPeerAddress.has(peerAddress)) {
      return this._conByPeerAddress.get(peerAddress)
    }

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
   */
  _advertise (uri) {
    this._wssAdvertise = DhtEvent.peerHoldRequest(
      this._keypair.getId(),
      uri,
      Buffer.alloc(0).toString('base64'),
      Date.now()
    )
  }

  /**
   */
  async _handleDhtEvent (e) {
    switch (e.type) {
      case 'gossipTo':
        await this._publish(
          null,
          this._keypair.getId(),
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
        await this._addConnection(e.id)
        break
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
      [cId], null, this._keypair.getId(), [], '$advertise$',
      msgpack.encode(this._wssAdvertise)
    )
  }

  /**
   */
  async _removeConnection (cId) {
    throw new Error('unimplemented')
  }

  /**
   */
  async _handleMessage (cId, data) {
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
        if (a === this._keypair.getId()) {
          isForUs = true
          break
        }
      }
      if (!isForUs) {
        return this._publish(
          msgId, fromPeerAddress, peerAddressList, type, message)
      }
    }

    switch (type) {
      case '$advertise$':
        const rem = msgpack.decode(message)
        this._conByPeerAddress.set(rem.peerAddress, cId)
        this._con.setMeta(cId, rem)
        this._newConTrack.resolve(rem.peerAddress, cId)
        await this._dht.post(DhtEvent.peerHoldRequest(
          rem.peerAddress,
          rem.peerTransport,
          rem.peerData,
          rem.peerTs
        ))
        break
      case '$gossip$':
        await this._dht.post(DhtEvent.remoteGossipBundle(
          fromPeerAddress, message.toString('base64')))
        break
      case '$request$':
        await this._spec.$emitEvent(P2pEvent.message(
          fromPeerAddress, msgId, message.toString('base64')
        ))
        break
      case '$response$':
        await this._spec.$checkResolveRequest(P2pEvent.message(
          fromPeerAddress, msgId, message.toString('base64')
        ))
        break
      default:
        throw new Error('unexpected protocol message type ' + type)
    }
  }
}

exports.P2pBackendHackmodePeer = P2pBackendHackmodePeer
