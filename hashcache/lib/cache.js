const BACKEND = {
  'sqlite3': require('./sqlite3backend').Sqlite3Backend
}

/**
 * Priority (LRU) cache, deletes old items on prune
 */
class PrioCache {
  /**
   * Don't use this directly, call await PrioCache.connect()
   */
  constructor (opt) {
    this._data = new Map()
    this._backend = opt.backend
    this._cacheSize = typeof opt.cacheSize === 'number'
      ? opt.cacheSize
      : 1024 * 1024 * 20 // 20 MiB
    this._currentSize = 0
  }

  /**
   * Constructor that connects our backend
   */
  static async connect (opt) {
    const backend = await BACKEND[opt.backend.type].connect(opt.backend.config)
    return new PrioCache({
      backend,
      cacheSize: opt.cacheSize
    })
  }

  /**
   * get a value from the cache
   */
  async get (ns, key) {
    const nsMap = this._getNsRef(ns)
    if (!nsMap.has(key)) {
      try {
        const data = await this._backend.get(ns, key)
        nsMap.set(key, [Date.now(), data])
      } catch (e) {
        nsMap.set(key, [Date.now(), Buffer.from('{}', 'utf8')])
      }
    }
    const ref = nsMap.get(key)
    ref[0] = Date.now()
    return JSON.parse(ref[1].toString('utf8'))
  }

  /**
   * set a value in the cache
   */
  async set (ns, key, data) {
    const nsMap = this._getNsRef(ns)

    data = Buffer.from(JSON.stringify(data), 'utf8')

    // do not `await` here... we want it to run in the background
    this._backend.set(ns, key, data)

    if (nsMap.has(key)) {
      this._currentSize -= nsMap.get(key)[1].byteLength
    }
    nsMap.set(key, [Date.now(), data])
    this._currentSize += data.byteLength
  }

  /**
   * prune if we are over our size
   */
  async prune () {
    if (this._currentSize < this._cacheSize) {
      return
    }
    const arr = []

    for (let [nsK, nsM] of this._data) {
      for (let [eK, eR] of nsM) {
        arr.push([eR[0], nsK, eK, eR[1].length])
      }
    }

    arr.sort(_timeSort)

    this._currentSize = 0
    for (let ref of arr) {
      if (this._currentSize + ref[3] > this._cacheSize) {
        this._data.get(ref[1]).delete(ref[2])
      } else {
        this._currentSize += ref[3]
      }
    }
  }

  // -- private -- //

  /**
   * helper fetch the namespaced map
   */
  _getNsRef (ns) {
    if (!this._data.has(ns)) {
      this._data.set(ns, new Map())
    }
    return this._data.get(ns)
  }
}

/**
 * used to sore LRU items
 */
function _timeSort (a, b) {
  if (a[0] < b[0]) {
    return 1
  } else if (a[0] > b[0]) {
    return -1
  }
  return 0
}

/**
 * Store namespaced items in an LRU memory cache
 * items are persisted using the specified backed (probably sqlite3)
 */
class HashCache {
  /**
   * Don't use this directly, see `await connect(opt)`
   */
  constructor (priocache, dispatchTimeout) {
    this._actions = new Map()
    this._queue = []
    this._running = false
    this._data = priocache
    this._dispatchTimeout = typeof dispatchTimeout === 'number'
      ? dispatchTimeout
      : 1000
  }

  /**
   * use this to create a HashCache instance
   * specify a backend / config params
   * @param {object} opt
   * @param {object} opt.backend
   * @param {string} opt.backend.type - e.g. 'sqlite3'
   * @param {object} opt.backend.config - any backend specific options
   * @param {string} opt.backend.config.file - e.g. ':memory:'
   * @param {number} opt.cacheSize - size in bytes to keep in memory
   * @param {number} opt.dispatchTimeout - in ms (e.g. 1000)
   */
  static async connect (opt) {
    return new HashCache(
      await PrioCache.connect(opt),
      opt.dispatchTimeout
    )
  }

  /**
   * register an action handler (or reducer in redux parlance)
   * @param {string} type - the handler type name
   * @param {function} fn - the handler callback function
   */
  async registerAction (type, fn) {
    if (typeof type !== 'string') {
      throw new Error('type must be string')
    }
    if (typeof fn !== 'function') {
      throw new Error('fn must be a function')
    }
    if (this._actions.has(type)) {
      throw new Error(type + ' already set as an action')
    }
    this._actions.set(type, fn)
  }

  /**
   * dispatch an action - will call the handler/reducer
   * @param {object} action
   * @param {string} action.type - the action type name
   * @param {string} action.ns - the namespace to work with
   * @param {array} action.fetch - list of hashes to fetch before invoking handler
   */
  async dispatch (action) {
    return new Promise((resolve, reject) => {
      const timeoutError = new Error('timeout')
      const timeout = setTimeout(() => {
        reject(timeoutError)
      }, this._dispatchTimeout)
      try {
        if (typeof action !== 'object') {
          throw new Error('action must be an object')
        }
        if (typeof action.type !== 'string') {
          throw new Error('action.type must be a string')
        }
        if (typeof action.ns !== 'string') {
          throw new Error('action.ns must be a string')
        }
        if (!Array.isArray(action.fetch)) {
          throw new Error('action.fetch must be an array')
        }
        for (let item of action.fetch) {
          if (typeof item !== 'string' || Buffer.from(item, 'base64').byteLength !== 32) {
            throw new Error('action.fetch must only contain 32 byte base64 strings')
          }
        }

        action = JSON.stringify(action)
        this._queue.push({
          action,
          resolve: (...args) => {
            clearTimeout(timeout)
            resolve(...args)
          },
          reject: (e) => {
            clearTimeout(timeout)
            reject(e)
          }
        })
        this._checkQueue()
      } catch (e) {
        clearTimeout(timeout)
        reject(e)
      }
    })
  }

  /**
   * get a value from the cache
   * @param {string} ns - the namespace
   * @param {string} hash - the base64 encoded 32 byte hash to fetch
   */
  async get (ns, hash) {
    return this._data.get(ns, hash)
  }

  // -- private -- //

  /**
   * do we need to process any actions?
   * @private
   */
  _checkQueue () {
    if (this._running) {
      return
    }
    if (!this._queue.length) {
      return
    }
    const { action, resolve, reject } = this._queue.shift()
    this._running = true

    this._process(JSON.parse(action), resolve, reject)
  }

  /**
   * we have an action to process... process it
   * @private
   */
  async _process (action, resolve, reject) {
    try {
      if (!this._actions.has(action.type)) {
        throw new Error('no reducer found for type "' + action.type + '"')
      }

      const fetched = new Map()
      const toFetch = []
      for (let fetch of action.fetch) {
        toFetch.push(new Promise(async (resolve, reject) => {
          try {
            const res = await this._data.get(action.ns, fetch)
            fetched.set(fetch, res)
            resolve()
          } catch (e) {
            reject(e)
          }
        }))
      }
      await Promise.all(toFetch)

      action.fetch = fetched
      const result = await (this._actions.get(action.type))(action)
      if (typeof result[Symbol.iterator] !== 'function') {
        throw new Error('result from reducer type "' + action.type + '" was not iterable')
      }

      const toSave = []
      for (const [key, value] of result) {
        toSave.push(this._data.set(action.ns, key, value))
      }
      await Promise.all(toSave)

      await this._data.prune()

      resolve()
    } catch (e) {
      reject(e)
    }

    this._running = false
    this._checkQueue()
  }
}

exports.HashCache = HashCache
