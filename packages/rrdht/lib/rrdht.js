const { AsyncClass, $sleep } = require('@holochain/n3h-common')
const defaultConfig = require('./default-config')
const { registerHandler } = require('./handlers/handler-manifest')
const actions = require('./actions')
const events = require('./events')

const REQUIRED_CONFIG = ['agentHash', 'agentNonce', 'agentPeerInfo']

/**
 */
class RRDht extends AsyncClass {
  /**
   */
  async init (config) {
    await super.init()

    this._actionQueue = [
      Object.freeze({
        action: 'init',
        params: null
      })
    ]

    this._actionHandlers = {}

    for (let key of REQUIRED_CONFIG) {
      if (!(key in config)) {
        throw new Error('cannot initialize rrdht config without item "' + key + '"')
      }
    }

    const configBuilder = defaultConfig.generateConfigBuilder()
    await configBuilder.attach(config)
    await this._attachConfigFns(configBuilder)
    this._config = await configBuilder.finalize(async c => {
      c.agentLoc = await c.agentLocFn(
        c.agentHash, c.agentNonce)
    })

    await registerHandler(this._config)

    setImmediate(() => this._tickle())

    this.$pushDestructor(async () => {
      this._actionQueue = []
      this._actionHandlers = {}
      this._config = {}
    })
  }

  // -- state mutation -- //

  /**
   * Take a mutation action on this instance.
   * See require('@holochain/rrdht').actions for options.
   */
  act (action) {
    if (typeof action.action !== 'string') {
      throw new Error('action must be a string')
    }
    if (typeof action.params !== 'object') {
      throw new Error('params must be a JSON.stringify-able object')
    }
    if (!(action.action in actions)) {
      throw new Error('"' + action.action + '" not recognized as a valid action')
    }

    const a = {
      action: action.action,
      params: JSON.stringify(action.params)
    }

    this._actionQueue.push(Object.freeze(a))
  }

  // -- immutable state accessors -- //

  /**
   * Determine if this instance would store this peer at this time
   * @param {string} peerHash - base64 peer hash
   * @param {string} peerNonce - base64 peer nonce
   */
  async wouldStorePeer (peerHash, peerNonce) {
  }

  /**
   * Determine if this instance would store this data at this time
   * @param {string} dataHash - base64 data hash
   */
  async wouldStoreData (dataHash) {
  }

  /**
   * If we have a local reference to this peer, return its peerInfo
   */
  async getLocalPeerInfo (peerHash) {
  }

  /**
   * @return {boolean} - true if we are tracking this data locally
   */
  async isDataLocal (dataHash) {
  }

  // -- private -- //

  /**
   */
  async _attachConfigFns (configBuilder) {
    await configBuilder.attach({
      'registerHandler': async (config, action, handler) => {
        if (!(action in this._actionHandlers)) {
          this._actionHandlers[action] = []
        }

        this._actionHandlers[action].push(handler)
      },

      'emit': async (config, evt) => {
        if (!events.isEvent(evt)) {
          throw new Error('can only emit events')
        }
        await Promise.all([
          this.emit(evt.type, evt),
          this.emit('all', evt)
        ])
      },

      'act': async (config, action) => {
        return this.act(action)
      }
    })
  }

  /**
   */
  async _tickle () {
    try {
      let lastTickle = Date.now()
      let waitMs = 0

      while (!this.$isDestroyed()) {
        const now = Date.now()

        if (now - lastTickle > 100) {
          lastTickle = now
          this._actionQueue.unshift(Object.freeze({
            action: 'tickle',
            params: JSON.stringify({
              now
            })
          }))
        }

        if (this._actionQueue.length) {
          waitMs = 0
          const action = this._actionQueue.shift()
          if (action.action in this._actionHandlers) {
            for (let handler of this._actionHandlers[action.action]) {
              if (this.$isDestroyed()) {
                return
              }
              await handler(this._config, action.action, JSON.parse(action.params))
            }
          }
        } else {
          waitMs += 1
          if (waitMs > 20) {
            waitMs = 20
          }
          await $sleep(waitMs)
        }
      }
    } catch (e) {
      console.error(e)
      process.exit(1)
    }
  }
}

exports.RRDht = RRDht
