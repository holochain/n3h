const { Sqlite3Backend } = require('./sqlite3backend')

/**
 */
class PrioCache {
  /**
   */
  constructor (opt) {
    this._data = new Map()
    this._backend = opt.backend
    this._cacheSize = typeof opt.cacheSize === 'number'
      ? opt.cacheSize
      : 1024 * 1024 * 20 // 20 MiB
  }

  /**
   */
  static async connect (opt) {
    return new PrioCache({
      backend: await Sqlite3Backend.connect(opt.sqlite3),
      cacheSize: opt.cacheSize
    })
  }

  /**
   */
  async get (key) {
    if (!this._data.has(key)) {
      try {
        const data = await this._backend.get(key)
        this._data.set(key, [Date.now(), data])
      } catch (e) {
        this._data.set(key, [Date.now(), '{}'])
      }
    }
    const ref = this._data.get(key)
    ref[0] = Date.now()
    return JSON.parse(ref[1])
  }

  /**
   */
  async set (key, data) {
    data = JSON.stringify(data)

    // do not `await` here... we want it to run in the background
    this._backend.set(key, data)

    this._data.set(key, [Date.now(), data])
  }

  /**
   */
  async prune () {
    console.log('@@ b4', Array.from(this._data.values()).map(v => { return v[0] }))
    const sorted = Array.from(this._data.entries()).sort(_timeSort)
    const newData = new Map()
    let bytes = 0
    for (let ref of sorted) {
      if (bytes + ref[1][1].length > this._cacheSize) {
        break
      }
      bytes += ref[1][1].length
      newData.set(ref[0], ref[1])
    }
    this._data = newData
    console.log('@@ pruned', Array.from(this._data.values()).map(v => { return v[0] }))
  }
}

function _timeSort (a, b) {
  if (a[1][0] < b[1][0]) {
    return 1
  } else if (a[1][0] > b[1][0]) {
    return -1
  }
  return 0
}

/**
 */
class HashCache {
  /**
   */
  constructor (priocache) {
    this._actions = new Map()
    this._queue = []
    this._running = false
    this._data = priocache
  }

  /**
   */
  static async connect (opt) {
    return new HashCache(await PrioCache.connect(opt))
  }

  /**
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
   */
  async dispatch (action) {
    return new Promise((resolve, reject) => {
      const timeoutError = new Error('timeout')
      const timeout = setTimeout(() => {
        reject(timeoutError)
      }, 1000)
      try {
        if (typeof action !== 'object') {
          throw new Error('action must be an object')
        }
        if (typeof action.type !== 'string') {
          throw new Error('action.type must be a string')
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
   */
  async get (hash) {
    return this._data.get(hash)
  }

  // -- private -- //

  /**
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
            const res = await this._data.get(fetch)
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
        toSave.push(this._data.set(key, value))
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
