const { AsyncClass, $sleep } = require('@holochain/n3h-common')
const defaultConfig = require('./default-config')
const { registerHandler } = require('./handlers/handler-manifest')
const range = require('./range')
const actions = require('./actions')
const events = require('./events')

const msgpack = require('msgpack-lite')

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

    this._nextId = Math.random();

    this._waitPromises = new Map()

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
    if ('msgId' in action && typeof action.msgId !== 'string') {
      throw new Error('msgId must be a string')
    }

    const a = {
      action: action.action,
      params: JSON.stringify(action.params)
    }

    if ('msgId' in action) {
      a.msgId = action.msgId
    }

    this._actionQueue.push(Object.freeze(a))
  }

  /**
   */
  async fetch (hash, timeout) {
    // - step 1 - check locally - //
    const local = await this.fetchLocal(hash, timeout)
    if (typeof local === 'string') {
      return local
    }

    const loc = await this._config.dataLocFn(hash)

    // - step 2 - check for peers we know of that should store it - //
    const storePeers = await this._config._.rangeStore.getPeersForLoc(loc)

    if (storePeers.length > 0) {
      const id = this.$getMsgId()
      const hp = this.$registerWaitHandler(id, timeout)

      const bundle = msgpack.encode([
        'dataQuery',
        id,
        Buffer.from(this._config.agentHash, 'base64'),
        Buffer.from(hash, 'base64')
      ]).toString('base64')

      if (storePeers.length < 3) {
        const wait = []
        for (let peer of storePeers) {
          wait.push(this._config.emit(events.gossipTo(peer, bundle)))
        }
        await Promise.all(wait)
      } else {
        const peers = []
        for (let i = 0; i < 4 && i < storePeers.length; ++i) {
          peers.push(storePeers[i])
        }
        const evt = events.unreliableGossipBroadcast(peers, bundle)
        await this._config.emit(evt)
      }

      const res = await hp;
      if (res && res.data) {
        return res
      }
    }

    // - step 3 - find the peer closest to it to query - //
    throw new Error('peer query unimplemented')
  }

  /**
   * If we have this hash locally, return it, otherwise return undefined
   * @param {string} hash - base64 hash to search for
   * @param {number} [timeout] - timeout to wait for data (default 5000 ms)
   * @return {Promise}
   */
  async fetchLocal (hash, timeout) {
    const ref = await this._config._.rangeStore.getHash(hash)

    if (ref) {
      if (ref.type === 'data') {
        const id = this.$getMsgId()
        const hp = this.$registerWaitHandler(id, timeout)
        await this._config.emit(events.dataFetch(hash, id))
        const res = await hp;
        if (res && res.data) {
          return res.data
        }
      } else {
        throw new Error('unhandled hash type ' + ref.type)
      }
    }
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

  // -- protected -- //

  /**
   */
  $getMsgId () {
    this._nextId += Math.random() + 0.00001
    return this._nextId.toString(36)
  }

  /**
   */
  $registerWaitHandler (msgId, timeout) {
    const timeoutStack = (new Error('timeout')).stack

    let timeoutId

    const cleanupFns = [() => {
      clearTimeout(timeoutId)
    }]

    const cleanup = () => {
      for (let fn of cleanupFns) {
        fn()
      }
    }

    return new Promise((resolve, reject) => {
      const result = {
        resolve: (...args) => {
          cleanup()
          resolve(...args)
        },
        reject: (e) => {
          cleanup()
          reject(e)
        }
      }

      timeoutId = setTimeout(() => {
        result.reject(new Error('timeout, inner stack: ' + timeoutStack))
      }, timeout || 5000)

      cleanupFns.push(() => {
        this._waitPromises.delete(msgId)
      })

      this._waitPromises.set(msgId, result)
    })
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
      },

      'getMsgId': async (config, action) => {
        return this.$getMsgId()
      },

      'registerWaitHandler': (config, msgId, timeout) => {
        if (this.$isDestroyed()) {
          return
        }
        return this.$registerWaitHandler(msgId, timeout)
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
          if (typeof action.msgId === 'string') {
            if (this._waitPromises.has(action.msgId)) {
              this._waitPromises.get(action.msgId).resolve(JSON.parse(action.params))
            } else {
              console.error('unhandled msgId ', action, this._waitPromises)
            }
          } else if (action.action in this._actionHandlers) {
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
