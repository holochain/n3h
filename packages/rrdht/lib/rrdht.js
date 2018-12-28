const { AsyncClass, $sleep } = require('@holochain/n3h-common')
const defaultConfig = require('./default-config')
const { registerHandler } = require('./handlers/handler-manifest')
const range = require('./range')
const actions = require('./actions')
const events = require('./events')

const REQUIRED_CONFIG = ['agentHash', 'agentNonce', 'agentPeerInfo']
const RE_RANGE = /^32r([0-9a-f]{8}):([0-9a-f]{8})$/

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

    const outPromise = new Promise((resolve, reject) => {
      this._config._._waitInit = {
        resolve,
        reject
      }
    })

    setImmediate(() => this._tickle())

    this.$pushDestructor(async () => {
      this._actionQueue = []
      this._actionHandlers = {}
      this._config = {}
    })

    return outPromise
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

  /**
   * If we have this hash locally, return it, otherwise return undefined
   * @param {string} hash - base64 hash to search for
   * @param {number} [timeout] - timeout to wait for data (default 5000 ms)
   * @return {Promise}
   */
  fetchLocal (hash, timeout) {
    const timeoutStack = (new Error('timeout')).stack
    return new Promise(async (resolve, reject) => {
      try {
        const timeoutId = setTimeout(() => {
          reject(new Error('timeout, inner stack: ' + timeoutStack))
        })
        const result = {
          resolve: (...args) => {
            clearTimeout(timeoutId)
            resolve(...args)
          },
          reject: (e) => {
            clearTimeout(timeoutId)
            reject(e)
          }
        }

        const ref = await this._config._.rangeStore.getHash(hash)
        if (ref) {
          resolve(true)
        } else {
          resolve(false)
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  // -- immutable state accessors -- //

  /**
   * return 24 hex digits representing 12 bytes
   * the first 4 bytes are the loc
   * the second 4 bytes are the hold radius
   * the third 4 bytes are the query radius
   * these are the data that will be gossiped about this node
   */
  async getRadii () {
    const loc = this._config.agentLoc
    const hold = range.rFromRadius(loc, this._config._.radii.hold)
    const query = range.rFromRadius(loc, this._config._.radii.query)
    const mH = hold.match(RE_RANGE)
    const mQ = query.match(RE_RANGE)
    const out = mH[1] + mH[2] + mQ[2]
    return out
  }

  /**
   * Determine if this instance would store this peer at this time
   * @param {string} peerHash - base64 peer hash
   * @param {string} peerNonce - base64 peer nonce
   */
  async wouldStorePeer (peerHash, peerNonce) {
    try {
      const loc = await this._config.agentLocFn(peerHash, peerNonce)
      return this._config._.rangeStore.wouldStore(loc)
    } catch (e) {
      return false
    }
  }

  /**
   * Determine if this instance would store this data at this time
   * @param {string} dataHash - base64 data hash
   */
  async wouldStoreData (dataHash) {
    try {
      const loc = await this._config.dataLocFn(dataHash)
      return this._config._.rangeStore.wouldStore(loc)
    } catch (e) {
      return false
    }
  }

  // -- private -- //

  /**
   */
  async _attachConfigFns (configBuilder) {
    await configBuilder.attach({
      'registerHandler': async (config, action, handler) => {
        if (this.$isDestroyed()) {
          return
        }
        if (!(action in this._actionHandlers)) {
          this._actionHandlers[action] = []
        }

        this._actionHandlers[action].push(handler)
      },

      'emit': async (config, evt) => {
        if (this.$isDestroyed()) {
          return
        }
        if (!events.isEvent(evt)) {
          throw new Error('can only emit events')
        }
        await Promise.all([
          this.emit(evt.type, evt),
          this.emit('all', evt)
        ])
      },

      'act': async (config, action) => {
        if (this.$isDestroyed()) {
          return
        }
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
