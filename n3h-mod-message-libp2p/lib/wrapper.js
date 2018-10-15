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

    console.log(nodeInfo)

    const thisPeerInfo = new PeerInfo(await $p(
      PeerId.createFromJSON.bind(PeerId, nodeInfo.id)))

    for (let bind of this._config.bindList) {
      thisPeerInfo.multiaddrs.add(bind)
    }

    console.log('##', thisPeerInfo)
  }
}

exports.Wrapper = Wrapper
