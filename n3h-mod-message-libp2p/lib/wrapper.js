const { $p, AsyncClass } = require('n3h-common')

const PeerInfo = require('peer-info')
const PeerId = require('peer-id')

const { LibP2pBundle } = require('./libp2p-bundle')

/**
 */
class Wrapper extends AsyncClass {
  /**
   */
  async init (modules, config) {
    await super.init()

    this._modules = modules
    this._config = config
  }

  /**
   */
  async start () {
    this.persistCache = this._modules.persistCache
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
      const result = await this._modules.ipc.handleSend(
        this.getId(),
        opt.from,
        opt.data)
      opt.resolve(result)
    })

    for (let connect of this._config.connectList) {
      console.error('connectlist not yet implemented', connect)
      process.exit(1)
    }

    this._modules.ipc.registerHandler(async (call, opt) => {
      switch (call.method) {
        case 'getId':
          opt.resolve(this.getId())
          return true
        case 'getBindings':
          opt.resolve(this.getBindings())
          return true
        case 'connect':
          // can take a while
          opt.resetTimeout(10000)

          await this.connect(call.address)
          opt.resolve()
          return true
        case 'send':
          // can take a while
          opt.resetTimeout(10000)

          const result = await this.send(call.toAddress, call.data)
          opt.resolve(result)
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
