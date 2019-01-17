const { AsyncClass } = require('@holochain/n3h-common')

const {
  Connection,
  Dht
} = require('@holochain/n3h-mod-spec')

const { ConnectionBackendWss } = require('@holochain/n3h-mod-connection-wss')
const { DhtBackendFullsync } = require('@holochain/n3h-mod-dht-fullsync')

/**
 */
class Node extends AsyncClass {
  /**
   */
  async init (options) {
    await super.init()

    this._bindings = new Set()

    this._dht = await new Dht(DhtBackendFullsync, options.dht)
    this._con = await new Connection(ConnectionBackendWss, options.connection)

    this.$pushDestructor(async () => {
      await this._con.destroy()
      await this._dht.destroy()

      this._bindings.clear()
      this._bindings = null
    })

    this._con.on('bind', b => b.forEach(b => this._addBinding(b)))
    this._con.on('connection', c => this._addConnection(c))
    this._con.on('connect', c => this._addConnection(c))
    this._con.on('close', c => this._removeConnection(c))
    this._con.on('message', (c, d) => this._handleMessage(c, d))

    await Promise.all(options.connection.bind.map(b => this._con.bind(b)))
  }

  /**
   */
  getBindings () {
    return this._bindings.values()
  }

  /**
   */
  async connect (addr) {
    return this._con.connect(addr)
  }

  // -- private -- //

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
