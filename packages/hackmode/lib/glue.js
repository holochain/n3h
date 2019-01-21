const { AsyncClass } = require('@holochain/n3h-common')
const { Keypair } = require('@holochain/hc-dpki')
const mosodium = require('@holochain/mosodium')
const { URL } = require('url')

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

    this._dht = await new Dht(DhtBackendFullsync, options.dht)
    this._con = await new Connection(ConnectionBackendWss, options.connection)

    this.$pushDestructor(async () => {
      await this._con.destroy()
      await this._dht.destroy()
      await this._keypair.destroy()

      this._bindings.clear()
      this._bindings = null
    })

    this._dht.on('event', e => this._handleDhtEvent(e))

    this._con.on('bind', b => b.forEach(b => this._addBinding(b)))
    this._con.on('connection', c => this._addConnection(c))
    this._con.on('connect', c => this._addConnection(c))
    this._con.on('close', c => this._removeConnection(c))
    this._con.on('message', (c, d) => this._handleMessage(c, d))

    const bind = Array.isArray(options.connection.bind) ?
      options.connection.bind :
      []

    await Promise.all(bind.map(b => this._con.bind(b)))

    this._wssAdvertise = null

    if (typeof options.wssAdvertise === 'string') {
      this._wssAdvertise = options.wssAdvertise
      if (this._wssAdvertise === 'auto') {
        this._wssAdvertise = this.getBindings().next().value
      }
      console.log('WSS ADVERTISE', this._wssAdvertise)
    } else if (typeof options.wssRelayPeer === 'string') {
      const url = new URL(options.wssRelayPeer)
      if (url.protocol !== 'wss:') {
        throw new Error('can only relay through a direct wss: peer, not ' + url.protocol)
      }
      if (!url.searchParams.has('a')) {
        throw new Error('invalid wssRelayPeer, no "a" param found on search string')
      }
      await this._con.connect(options.wssRelayPeer)
      this._wssAdvertise = 'relay+wss://' + url.searchParams.get('a')
    }

    this._wssAdvertise += '?a=' + this._keypair.getId()

    const thisPeer = DhtEvent.peerHoldRequest(
      this._keypair.getId(),
      this._wssAdvertise,
      Buffer.alloc(0).toString('base64'),
      Date.now()
    )

    this._dht.post(thisPeer)
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

  // -- private -- //

  _handleDhtEvent (e) {
    console.log('--')
    console.log(e)

    switch (e.type) {
      case 'gossipTo':
        console.log('aaaa')
        break
      default:
        throw new Error('unhandled dht event type ' + e.type + ' ' + JSON.stringify(e))
    }
    console.log('--')
  }

  _addBinding (binding) {
    this._bindings.add(binding)
  }

  _addConnection (c) {
    console.log('connection', c)
  }

  _removeConnection (c) {
    console.log('close', c)
  }

  _handleMessage (c, d) {
    console.log('message', c, d)
  }
}

exports.Node = Node
