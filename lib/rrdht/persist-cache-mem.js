const { AsyncClass } = require('../n3h-common')

/**
 */
class PersistCacheMem extends AsyncClass {
  /**
   */
  async init () {
    await super.init()

    this._data = new Map()
  }

  /**
   */
  async keys (ns) {
    return this._getNsRef(ns).keys()
  }

  /**
   */
  async has (ns, key) {
    assertString(ns, 'ns should be a string')
    assertString(key, 'key should be a string')

    return this._getNsRef(ns).has(key)
  }

  /**
   */
  async get (ns, key) {
    assertString(ns, 'ns should be a string')
    assertString(key, 'key should be a string')

    return this._getNsRef(ns).get(key)
  }

  /**
   */
  async set (ns, key, data) {
    assertString(ns, 'ns should be a string')
    assertString(key, 'key should be a string')
    assertString(data, 'data should be a string')

    this._getNsRef(ns).set(key, data)
  }

  /**
   */
  async remove (ns, key) {
    assertString(ns, 'ns should be a string')
    assertString(key, 'key should be a string')

    this._getNsRef(ns).delete(key)
  }

  // -- private -- //

  /**
   * helper fetch the namespaced map
   */
  _getNsRef (ns) {
    if (!ns) {
      throw new Error('ns must be defined!')
    }
    if (!this._data.has(ns)) {
      this._data.set(ns, new Map())
    }
    return this._data.get(ns)
  }
}

exports.PersistCacheMem = PersistCacheMem

/**
 */
function assertString (v, t) {
  if (typeof v !== 'string') {
    throw new Error(t || 'expected string')
  }
}
