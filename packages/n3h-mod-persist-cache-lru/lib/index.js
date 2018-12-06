const { AsyncClass } = require('@holochain/n3h-common')

/**
 * used to sort LRU items
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
 */
class PersistCacheLru extends AsyncClass {
  static getDefinition () {
    return {
      type: 'persistCache',
      name: 'lru',
      defaultConfig: {
        '#cacheSize': 'size in bytes to limit contents in memory (e.g. 1024 * 1024 * 20 === 20 MiB)',
        cacheSize: 1024 * 1024 * 20
      }
    }
  }

  /**
   */
  getNsAsStringJson (ns) {
    return {
      set: async (key, value) => {
        return this.set(
          ns,
          Buffer.from(key, 'utf8'),
          Buffer.from(JSON.stringify(value), 'utf8'))
      },
      get: async (key) => {
        let out = await this.get(
          ns,
          Buffer.from(key, 'utf8'))
        if (out) {
          out = JSON.parse(out.toString('utf8'))
        }
        return out
      }
    }
  }

  /**
   */
  async init (config, system) {
    await super.init()

    this._currentSize = 0

    this._config = config
    this._system = system

    this._data = new Map()
  }

  /**
   */
  async ready () {
    this._persist = this._system.nvPersist
  }

  /**
   * get a value from the cache
   */
  async get (ns, key) {
    const key64 = key.toString('base64')

    const nsMap = this._getNsRef(ns)
    if (!nsMap.has(key64)) {
      const data = await this._persist.get(ns, key)
      if (!data) {
        return null
      }
      nsMap.set(key64, [Date.now(), data])
      this._currentSize += data.byteLength
    }
    const ref = nsMap.get(key64)
    ref[0] = Date.now()
    const out = ref[1]
    await this.prune()
    return out
  }

  /**
   * set a value in the cache
   */
  async set (ns, key, data) {
    const key64 = key.toString('base64')

    const nsMap = this._getNsRef(ns)

    await this._persist.set(ns, key, data)

    if (nsMap.has(key64)) {
      this._currentSize -= nsMap.get(key64)[1].byteLength
    }
    nsMap.set(key64, [Date.now(), data])
    this._currentSize += data.byteLength

    await this.prune()
  }

  /**
   * prune if we are over our size
   */
  async prune () {
    if (this._currentSize < this._config.cacheSize) {
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
      if (this._currentSize + ref[3] > this._config.cacheSize) {
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

exports.PersistCacheLru = PersistCacheLru
