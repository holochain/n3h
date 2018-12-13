const { AsyncClass, $sleep } = require('@holochain/n3h-common')
const defaultConfig = require('./default-config')
const { registerHandler } = require('./handlers/handler-manifest')
const actions = require('./actions')

const REQUIRED_CONFIG = ['agentHash', 'agentNonce']
const RESERVED_CONFIG = ['agentLoc', 'registerHandler', 'emit', 'act']

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
      /*
      if (typeof v === 'function') {
        this._config[k] = v.bind(v, this._config)
      } else {
        this._config[k] = v
      }
      */
      this._config[k] = v
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

    this._config.agentLoc = await this._config.agentLocFn(
      this._config, this._config.agentHash, this._config.agentNonce)

    this._finalizeConfig(attach)

    registerHandler(this._config)

    setImmediate(() => this._tickle())

    this.$pushDestructor(async () => {
      this._actionQueue = []
      this._actionHandlers = {}
      this._config = {}
    })
  }

  // -- state mutation -- //

  /**
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

  // -- private -- //

  /**
   */
  _finalizeConfig (attach) {
    attach('registerHandler', async (action, handler) => {
      if (!(action in this._actionHandlers)) {
        this._actionHandlers[action] = []
      }

      this._actionHandlers[action].push(handler)
    })

    attach('emit', async (name, ...args) => {
      return this.emit(name, ...args)
    })

    attach('act', async (action) => {
      return this.act(action)
    })

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
        agentNonce: 'b+OXWcbfUO/eq3wmPk/RYjUWheTC/V/t+EqfIaUDJvU='
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
      dht.act(actions.registerPeer('my-hash', {
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
