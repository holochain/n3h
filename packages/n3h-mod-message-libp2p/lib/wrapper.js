const { $p, AsyncClass } = require('@holochain/n3h-common')

const PeerInfo = require('peer-info')
const PeerId = require('peer-id')

const { LibP2pBundle } = require('./libp2p-bundle')

/**
 */
class Wrapper extends AsyncClass {
  static getDefinition () {
    return {
      type: 'message',
      name: 'libp2p',
      defaultConfig: {
        '#bindList': 'array of multiaddr network interfaces to listen on (can be empty)',
        bindList: [
          '/ip4/0.0.0.0/tcp/0'
        ],
        '#connectList': 'array of initial outgoing bootstrap connections to make (can be empty)',
        connectList: [
        ]
      }
    }
  }

  /**
   */
  async init (config, system) {
    await super.init()

    this._system = system
    this._config = config
  }

  /**
   */
  async ready () {
    this.persistCache = this._system.persistCache
      .getNsAsStringJson('libp2p')

    let nodeInfo = await this.persistCache.get('nodeInfo')
    if (!nodeInfo) {
      console.error('no PeerInfo found! generating (this may take a while)')

      const thisPeerId = await $p(PeerId.create.bind(
        PeerId, { bits: 512 }))

      await this.persistCache.set('nodeInfo', {
        id: thisPeerId.toJSON()
      })
      nodeInfo = await this.persistCache.get('nodeInfo')
    }

    const thisPeerInfo = new PeerInfo(await $p(
      PeerId.createFromJSON.bind(PeerId, nodeInfo.id)))

    for (let bind of this._config.bindList) {
      thisPeerInfo.multiaddrs.add(bind)
    }

    this._node = await new LibP2pBundle({
      peerInfo: thisPeerInfo
    })

    this._node.on('handleSend', async opt => {
      console.log('@@ handleSend @@', opt.from, opt.data)
      await this._system.ipc.handleSend({
        toAddress: this.getId(),
        fromAddress: opt.from,
        data: opt.data,
        resolve: opt.resolve,
        reject: opt.reject
      })
    })

    this._node.on('peerConnected', async id => {
      this._system.ipc.send('json', {
        method: 'peerConnected',
        id
      })
    })

    this._node.on('peerDisconnected', async id => {
      this._system.ipc.send('json', {
        method: 'peerDisconnected',
        id
      })
    })

    for (let connect of this._config.connectList) {
      console.error('connectlist not yet implemented', connect)
      process.exit(1)
    }

    this._system.ipc.registerHandler(async (data, send) => {
      console.log('@@ libp2p check', data)
      switch (data.method) {
        case 'requestState':
          send('json', {
            method: 'state',
            state: 'ready',
            id: this.getId(),
            bindings: this.getBindings()
          })
          return true
        case 'connect':
          await this.connect(data.address)
          return true
        case 'send':
          const result = await this.send(data.toAddress, data.data)
          send('json', {
            method: 'sendResult',
            _id: data._id,
            data: result
          })
          return true
      }
      return false
    })
  }

  /**
   */
  getId () {
    return this._node.getId()
  }

  /**
   */
  getBindings () {
    return this._node.getBindings()
  }

  /**
   */
  async connect (multiaddr) {
    return this._node.connect(multiaddr)
  }

  /**
   */
  async send (toAddress, data) {
    return this._node.send(toAddress, data)
  }
}

exports.Wrapper = Wrapper
