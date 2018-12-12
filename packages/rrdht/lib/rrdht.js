const { AsyncClass, $sleep } = require('@holochain/n3h-common')
const defaultConfig = require('./default-config')

/**
 */
class RRDht extends AsyncClass {
  /**
   */
  async init (config) {
    await super.init()

    this._config = {}

    if (typeof config === 'object') {
      for (let k in config) {
        this._config[k] = config[k]
      }
    }

    for (let k in defaultConfig) {
      if (!(k in this._config)) {
        this._config[k] = defaultConfig[k]
      }
    }

    Object.freeze(this._config)

    this._actionQueue = []
    this._actionQueueContinue = true

    setImmediate(() => this._tickle())

    this.$pushDestructor(async () => {
      this._actionQueueContinue = false
    })
  }

  // -- state mutation -- //

  /**
   */
  queueAction (action) {
    if (typeof action.action !== 'string') {
      throw new Error('action must be a string')
    }
    if (typeof action.params !== 'object') {
      throw new Error('params must be a JSON.stringify-able object')
    }
    action.params = JSON.stringify(action.params)
    Object.freeze(action)

    this._actionQueue.push(action)
  }

  /**
   */
  registerPeer (hash, peerInfo) {
    return this.queueAction({
      action: 'registerPeer',
      params: {
        hash,
        peerInfo
      }
    })
  }

  // -- immutable state accessors -- //

  // -- private -- //

  /**
   */
  async _tickle () {
    try {
      let lastTickle = 0
      let waitMs = 0
      while (this._actionQueueContinue) {
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
          const fnName = '_action$' + action.action
          if (!(fnName in this)) {
            throw new Error('unhandled action ' + action.action)
          }
          await this[fnName](action.action, JSON.parse(action.params))
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

  async _action$tickle (action, params) {
    console.log('tickle')
    await this.emit('action', action, params)
  }

  async _action$registerPeer (action, params) {
    console.log('registerPeer')
    await this.emit('action', action, params)
  }
}

exports.RRDht = RRDht

function test () {
  return new Promise(async (resolve, reject) => {
    try {
      const dht = await new RRDht()
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
      dht.registerPeer('hash', {
        agentId: 'yay',
        transportId: 'other'
      })
    } catch (e) {
      reject(e)
    }
  })
}

test().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
