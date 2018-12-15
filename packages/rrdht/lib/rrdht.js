const { AsyncClass, $sleep } = require('@holochain/n3h-common')
const defaultConfig = require('./default-config')
const { registerHandler } = require('./handlers/handler-manifest')
const actions = require('./actions')

const MAGIC = '$rrdht$config$'
const CLASS_CONFIG = ['PersistCache']
const REQUIRED_CONFIG = ['agentHash', 'agentNonce', 'agentPeerInfo']
const RESERVED_CONFIG = [
  MAGIC,
  'agentLoc',
  'registerHandler',
  'emit',
  'act',
  'persistCacheProxy',
  '$',
  'runtimeState',
  '_'
]
const PROXY_FIX = [
  'then',
  'Symbol(util.inspect.custom)',
  'inspect',
  'Symbol(Symbol.iterator)',
  'Symbol(Symbol.toStringTag)'
]

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

    this._config = {}

    const attach = (k, v) => {
      if (typeof v === 'function' && CLASS_CONFIG.indexOf(k) < 0) {
        this._config[k] = (...args) => v(this._config, ...args)
      } else {
        this._config[k] = v
      }
    }

    if (typeof config === 'object') {
      for (let k in config) {
        attach(k, config[k])
      }
    }

    for (let key of REQUIRED_CONFIG) {
      if (!(key in this._config)) {
        throw new Error('cannot initialize rrdht without config "' + key + '"')
      }
    }

    for (let key of RESERVED_CONFIG) {
      if (key in this._config) {
        throw new Error('"' + key + '" is a reserved config key')
      }
    }

    for (let k in defaultConfig) {
      if (!(k in this._config)) {
        attach(k, defaultConfig[k])
      }
    }

    this._config[MAGIC] = true

    // some data about ourselves are accessed so often
    // we put them on the config object itself
    this._config.agentLoc = await this._config.agentLocFn(
      this._config.agentHash, this._config.agentNonce)

    await this._finalizeConfig(attach)

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
  async _finalizeConfig (attach) {
    attach('registerHandler', async (config, action, handler) => {
      if (!(action in this._actionHandlers)) {
        this._actionHandlers[action] = []
      }

      this._actionHandlers[action].push(handler)
    })

    attach('emit', async (config, name, ...args) => {
      return this.emit(name, ...args)
    })

    attach('act', async (config, action) => {
      return this.act(action)
    })

    const proxyCache = {}
    attach('persistCacheProxy', async (config, ns) => {
      if (!(ns in proxyCache)) {
        proxyCache[ns] = new Proxy(Object.create(null), {
          has: (_, prop) => {
            return (async () => {
              return !!(await config.persistCacheGet(ns, prop))
            })()
          },
          get: (_, prop) => {
            // it's hard to return a proxy from an async function in nodejs...
            if (PROXY_FIX.indexOf(prop.toString()) > -1) {
              return
            }
            return (val) => {
              if (typeof val === 'undefined') {
                return config.persistCacheGet(ns, prop)
              } else {
                return config.persistCacheSet(ns, prop, val)
              }
            }
          },
          set: () => {
            throw new Error('use `await config.prop()` to get, `await config.prop(val)` to set')
          }
        })
      }
      return proxyCache[ns]
    })

    attach('$', await this._config.persistCacheProxy('$'))

    const runtimeState = {}
    attach('runtimeState', runtimeState)
    attach('_', runtimeState)

    Object.freeze(this._config)
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

function test () {
  return new Promise(async (resolve, reject) => {
    try {
      const dht = await new RRDht({
        agentHash: 'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=',
        agentNonce: 'b+OXWcbfUO/eq3wmPk/RYjUWheTC/V/t+EqfIaUDJvU=',
        agentPeerInfo: {
          transportAddress: 'ip4/127.0.0.1/5556'
        }
      })
      dht.on('action', async (action, params) => {
        try {
          console.log(action, JSON.stringify(params, null, 2))
          if (action === 'registerPeer') {
            await dht.destroy()
            resolve()
          }
        } catch (e) {
          reject(e)
        }
      })
      await $sleep(250)
      dht.act(actions.peerHoldRequest('my-hash', 'nonce', {
        agentId: 'yay',
        transportId: 'other'
      }))
    } catch (e) {
      reject(e)
    }
  })
}

test().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
