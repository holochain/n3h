const modules = require('../modules')
const state = require('../state')

const { AsyncClass } = require('n3h-common')

// libp2p
const { Node } = require('hc-p2p-libp2p')

class MessengerInstanceLibp2p extends AsyncClass {
  constructor (config) {
    super()

    return AsyncClass.$construct(this, async (self) => {
      self._config = config
      self._node = null

      self.$pushDestructor(async () => {
        self._config = null
        if (self._node) {
          await self._node.close()
          self._node = null
        }
      })

      return self
    })
  }

  async init () {
    this._node = new Node()
    console.log('THIS IS CAUSING A TIMEOUT!!!')
    await this._node.init('ipc://ee.socket', '/ip4/0.0.0.0/tcp/0')
    console.log('messenger initialize', Object.keys(state.modules))
  }
}

class Messenger extends AsyncClass {
  constructor () {
    super()

    return AsyncClass.$construct(this, async (self) => {
      self._inst = null

      self.$pushDestructor(async () => {
        if (self._inst) {
          await self._inst.destroy()
        }
        self._inst = null
      })

      return self
    })
  }

  async getDefaultConfig () {
    return {
      '#type': 'which messenger to use `libp2p` or `n3h`',
      type: 'libp2p',
      '#libp2p': 'configuration if `type` is `libp2p`',
      libp2p: {
      },
      '#n3h': 'configuration if `type` is `n3h`',
      n3h: {
      }
    }
  }

  async createInstance (config) {
    if (!this._inst) {
      switch (config.type) {
        case 'libp2p':
          this._inst = await new MessengerInstanceLibp2p()
          break
        case 'n3h':
          throw new Error('n3h is not yet implemented')
        default:
          throw new Error('messenger type `' + config.messenger.type + '` not implemented')
      }
    }
    return this._inst
  }

  async initInstance () {
    if (!this._inst) {
      throw new Error('instance not yet created')
    }
    await this._inst.init()
  }
}

modules.registerModule('messenger', new Messenger())
