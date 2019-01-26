const { AsyncClass, Track } = require('@holochain/n3h-common')
const { Keypair } = require('@holochain/hc-dpki')
const mosodium = require('@holochain/mosodium')
const { URL } = require('url')
const msgpack = require('msgpack-lite')

const {
  Connection,
  Dht
} = require('@holochain/n3h-mod-spec')
const DhtEvent = Dht.DhtEvent

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
class P2pBackendGlue extends AsyncClass {
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
    //this._requestTrack = await new Track()
    this._bindings = new Set()

    this._conByPeerAddress = new Map()

    /*
    this._conState = new Map()
    this._waitNodeConnection = new Map()
    this._outMsgs = new Map()
    */

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
      //await this._requestTrack.destroy()
      await this._con.destroy()
      await this._dht.destroy()
      await this._keypair.destroy()

      /*
      this._conByPeerAddress.clear()
      this._conByPeerAddress = null

      this._conState.clear()
      this._conState = null
      */

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
    return this._publish(peerAddressList, 'publish', data)
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
    console.log(' --- skipping request -- please implement --- ')
  }

  // -- private -- //

  /**
   */
  async _publish (peerAddressList, type, data) {
    const cIds = await Promise.all(peerAddressList.map(
      a => this._ensureCIdForPeerAddress(a)))

    return this._sendByCId(cIds, null, peerAddressList, type, data)
  }

  /**
   */
  async _sendByCId (cIdList, msgId, peerAddressList, type, data) {
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer')
    }
    return this._con.send(cIdList, msgpack.encode([
      msgId, peerAddressList, type, data]).toString('base64'))
  }

  /*
  async _newConnection (peerTransport) {
    const uri = new URL(peerTransport)
    switch (uri.protocol) {
      case 'wss:':
        return this._newConnectionDirect(uri)
        break
      case 'holorelay:':
        return this._newConnectionRelay(uri)
        break
      default:
        throw new Error('unhandled newConnection protocol: ' + uri.protocol)
    }
  }

  async _newConnectionRelay (uri) {
    const relayAddress = uri.hostname
    if (!uri.searchParams.has('a')) {
      throw new Error('cannot connect to peer without nodeId ("a" param)')
    }
    const remId = uri.searchParams.get('a')
    console.log('RELAY', relayAddress)
    const relayState = await this._fetchConState(relayAddress)
    const state = await new ConState(this,
      async (data) => {
        if (!(data instanceof Buffer)) {
          throw new Error('data must be a buffer')
        }
        const relayState = await this._fetchConState(relayAddress)
        return relayState.publish('$relay$', msgpack.encode([
          remId, data]))
      }
    )
    await this._registerConState('relay:' + relayAddress, state)
  }
  */

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
    throw new Error('unimplemented')
  }

  /**
   */
  async _fetchConState (peerAddress) {
    // short circuit if we already have a connection open here
    if (this._conByPeerAddress.has(peerAddress)) {
      const state = this._conByPeerAddress.get(peerAddress)
      return state
    }
    const peer = await this._dht.fetchPeer(peerAddress)
    if (!peer) {
      throw new Error('could not message peer ' + peerAddress)
    }
    return this._newConnection(peer.peerTransport +
      '?a=' + peer.peerAddress)
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
    /*
    console.log('--dht--')
    console.log(e)
    */

    switch (e.type) {
      case 'gossipTo':
        await this._publish(e.peerList, '$gossip$', e.bundle)
        break
      case 'peerHoldRequest':
        // no validation / indexing for now,
        // just pass it back in
        this._dht.post(e)
        break
      default:
        throw new Error('unhandled dht event type ' + e.type + ' ' + JSON.stringify(e))
    }

    // console.log('--')
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
  async _registerConState (cId, state) {
    this._conState.set(cId, state)
    state.on('message', async (m) => {
      try {
        switch (m.type) {
          case '$relay$':
            const data = msgpack.decode(m.data)
            if (!this._conByPeerAddress.has(data[0])) {
              throw new Error('trying to relay, but we have no connection! ' + data[0])
            }
            const state = this._conByPeerAddress.get(data[0])
            if (!cId.startsWith('direct:')) {
              throw new Error('cannot relay through non-direct connections')
            }
            const ccId = cId.replace(/^direct:/, '')
            await this._con.send([ccId], data[1].toString('base64'))
            break
          default:
            this.emit('message', m)
            break
        }
      } catch (e) {
        console.error(e)
        process.exit(1)
      }
    })
    await state.handshake()
    console.log('connection', cId)
  }

  /**
   */
  async _addConnection (cId) {
    return this._sendByCId([cId], null, [], '$advertise$',
      msgpack.encode(this._wssAdvertise))
  }

  /**
   */
  async _removeConnection (cId) {
    cId = 'direct:' + cId
    console.log('close', cId)
    if (this._conState.has(cId)) {
      const state = this._conState.get(cId)
      if (state._remId && this._conByPeerAddress.has(state._remId)) {
        this._conByPeerAddress.delete(state._remId)
      }
      await state.destroy()
      this._conState.delete(cId)
    }
  }

  /**
   */
  async _handleMessage (cId, data) {
    data = msgpack.decode(Buffer.from(data, 'base64'))
    if (!Array.isArray(data) || data.length !== 4) {
      throw new Error('unexpected protocol data' + JSON.stringify(data))
    }
    const type = data[2]
    switch (type) {
      case '$advertise$':
        const rem = msgpack.decode(data[3])
        this._dht.post(DhtEvent.peerHoldRequest(
          rem.peerAddress,
          rem.peerTransport,
          rem.peerData,
          rem.peerTs
        ))
        this._conByPeerAddress.set(rem.peerAddress, cId)
        this._newConTrack.resolve(rem.peerAddress, cId)
        break
      default:
        throw new Error('unexpected protocol message type ' + type)
    }
  }

  /**
   */
  async _checkWaitNodeConnection (peerAddress) {
    if (this._waitNodeConnection.has(peerAddress)) {
      for (let r of this._waitNodeConnection.get(peerAddress)) {
        r.resolve()
      }
    }
  }
}

exports.P2pBackendGlue = P2pBackendGlue

/**
 */
class ConState extends AsyncClass {
  /**
   */
  async init (node, sendFn) {
    await super.init()
    this._node = node
    this._sendFn = sendFn

    this._wait = new Map()
  }

  /**
   */
  async handshake () {
    const rem = JSON.parse((await this._req('$id$')).toString())
    if (!rem) {
      console.error('handshake fail')
      return
    }
    this._remAdvertise = DhtEvent.peerHoldRequest(
      rem.peerAddress,
      rem.peerTransport,
      rem.peerData,
      rem.peerTs
    )
    this._node._dht.post(this._remAdvertise)
    this._node._conByPeerAddress.set(this._remAdvertise.peerAddress, this)
    await this._node._checkWaitNodeConnection(this._remAdvertise.peerAddress)
  }

  /**
   */
  async send (type, data) {
    return this._req(type, data)
  }

  /**
   */
  async publish (type, data) {
    await this._sendFn(msgpack.encode([type, null, data]))
  }

  /**
   */
  async handleMessage (data) {
    data = msgpack.decode(Buffer.from(data, 'base64'))
    if (!Array.isArray(data) || data.length !== 3) {
      throw new Error('bad glue data: ' + JSON.stringify(data))
    }
    const id = data[1]
    switch (data[0]) {
      case '$':
        if (this._wait.has(id)) {
          this._wait.get(id).resolve(data[2])
        }
        break
      case '$id$':
        await this._res(id, Buffer.from(JSON.stringify(this._node._wssAdvertise)))
        break
      case '$gossip$':
        this._node._dht.post(DhtEvent.remoteGossipBundle(this._remAdvertise.peerAddress, data[2].toString('base64')))
        break
      default:
        await this.emit('message', {
          type: data[0],
          data: data[2],
          respond: (rData) => {
            return this._res(id, rData)
          }
        })
        break
    }
  }

  // -- private -- //

  /**
   */
  async _res (id, data) {
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer')
    }
    return this._sendFn(msgpack.encode([
      '$', id, data
    ]))
  }

  /**
   */
  async _req (type, data) {
    const timeoutStack = (new Error('timeout')).stack
    return new Promise(async (resolve, reject) => {
      try {
        const id = this.$createUid()
        const timer = setTimeout(() => {
          clean()
          r.reject(new Error(timeoutStack))
        }, 5000)
        const clean = () => {
          clearTimeout(timer)
          this._wait.delete(id)
        }
        const r = {
          resolve: (...args) => {
            clean()
            resolve(...args)
          },
          reject: (e) => {
            clean()
            reject(e)
          }
        }
        this._wait.set(id, r)
        await this._sendFn(msgpack.encode([
          type, id, data
        ]))
      } catch (e) {
        reject(e)
      }
    })
  }
}
