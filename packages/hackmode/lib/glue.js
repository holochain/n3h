const { AsyncClass } = require('@holochain/n3h-common')
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
class Node extends AsyncClass {
  /**
   */
  async init (options) {
    await super.init()

    const seed = new mosodium.SecBuf(32)
    seed.randomize()

    this._keypair = await Keypair.newFromSeed(seed)
    console.log('== node id ==')
    console.log(this._keypair.getId())
    console.log('== end node id ==')

    this._bindings = new Set()
    this._conState = new Map()
    this._conById = new Map()

    this._con = await new Connection(ConnectionBackendWss, options.connection)

    this._con.on('event', e => this._handleConEvent(e))

    const bind = Array.isArray(options.connection.bind)
      ? options.connection.bind
      : []

    await Promise.all(bind.map(b => this._con.bind(b)))

    this._wssAdvertise = null
    let bootstrapPeer = null

    if (typeof options.wssAdvertise === 'string') {
      let uri = options.wssAdvertise
      if (uri === 'auto') {
        uri = this.getBindings().next().value
      }
      this._advertise(uri)
    } else if (Array.isArray(options.wssRelayPeers) && options.wssRelayPeers.length) {
      bootstrapPeer = options.wssRelayPeers[0]
      if (options.wssRelayPeers.length > 1) {
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

    options.dht.thisPeer = this._wssAdvertise

    this._dht = await new Dht(DhtBackendFullsync, options.dht)
    this._dht.on('event', e => this._handleDhtEvent(e))

    this.$pushDestructor(async () => {
      await this._con.destroy()
      await this._dht.destroy()
      await this._keypair.destroy()

      this._conById.clear()
      this._conById = null

      this._conState.clear()
      this._conState = null

      this._bindings.clear()
      this._bindings = null
    })

    if (bootstrapPeer) {
      await this._con.connect(bootstrapPeer)
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
    return this._wssAdvertise
  }

  /**
   */
  async connect (addr) {
    return this._con.connect(addr)
  }

  /**
   */
  async send (peerAddress, type, data) {
    // short circuit if we already have a connection open here
    if (this._conById.has(peerAddress)) {
      const state = this._conById.get(peerAddress)
      return state.send(type, data)
    }
    const peer = await this._dht.fetchPeer(peerAddress)
    if (!peer) {
      throw new Error('could not message peer ' + peerAddress)
    }
    console.error('fetch got peer:', peer)
    throw new Error('unimplemented')
  }

  // -- private -- //

  /**
   */
  _advertise (uri) {
    this._wssAdvertise = uri + '?a=' + this._keypair.getId()

    console.log('WSS ADVERTISE', this._wssAdvertise)

    this._wssAdvertise = DhtEvent.peerHoldRequest(
      this._keypair.getId(),
      this._wssAdvertise,
      Buffer.alloc(0).toString('base64'),
      Date.now()
    )
  }

  /**
   */
  async _handleDhtEvent (e) {
    console.log('--dht--')
    console.log(e)

    switch (e.type) {
      case 'gossipTo':
        let wait = []
        for (let peer of e.peerList) {
          if (peer === this._keypair.getId()) {
            console.log('ignoring gossipTo THIS PEER')
          } else {
            wait.push(this.send(peer, '$gossip$',
              Buffer.from(e.bundle, 'base64')))
          }
        }
        await Promise.all(wait)
        break
      default:
        throw new Error('unhandled dht event type ' + e.type + ' ' + JSON.stringify(e))
    }
    console.log('--')
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
    const state = await new ConState(this, cId)
    state.on('message', (m) => {
      this.emit('message', m)
    })
    this._conState.set(cId, state)
    console.log('connection', cId)
    await this._conState.get(cId).handshake()
  }

  /**
   */
  async _removeConnection (cId) {
    console.log('close', cId)
    if (this._conState.has(cId)) {
      const state = this._conState.get(cId)
      if (state._remId && this._conById.has(state._remId)) {
        this._conById.delete(state._remId)
      }
      await state.destroy()
      this._conState.delete(cId)
    }
  }

  /**
   */
  async _handleMessage (cId, data) {
    if (this._conState.has(cId)) {
      await this._conState.get(cId).handleMessage(data)
    }
  }
}

exports.Node = Node

/**
 */
class ConState extends AsyncClass {
  /**
   */
  async init (node, conId) {
    await super.init()
    this._node = node
    this._conId = conId

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
    this._node._conById.set(this._remAdvertise.peerAddress, this)
  }

  /**
   */
  async send (type, data) {
    if (typeof type !== 'string') {
      throw new Error('type must be a string')
    }
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a buffer')
    }
    return this._req(type, data)
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
        this._res(id, Buffer.from(JSON.stringify(this._node._wssAdvertise)))
        break
      case '$gossip$':
        this._node._dht.post(DhtEvent.remoteGossipBundle(this._remAdvertise.peerAddress, data[2].toString('base64')))
        break
      default:
        await this.emit('message', {
          type: data[0],
          data: data[2],
          respond: (rData) => {
            this._res(id, rData)
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
    await this._node._con.send([this._conId], msgpack.encode([
      '$', id, data
    ]).toString('base64'))
  }

  /**
   */
  async _req (type, data) {
    return new Promise(async (resolve, reject) => {
      try {
        const id = this.$createUid()
        const timer = setTimeout(() => {
          clean()
          r.reject(new Error('timeout'))
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
        await this._node._con.send([this._conId], msgpack.encode([
          type, id, data
        ]).toString('base64'))
      } catch (e) {
        reject(e)
      }
    })
  }
}
