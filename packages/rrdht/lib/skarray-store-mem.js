/*
 * SK = sorted key
 * sorted int32 keys index into arrays of hashes
 * used for looking up hashes based on int32 locations
 * this is an in-memory store,
 * please use a disk persisted option for production solutions
 */

const { AsyncClass } = require('@holochain/n3h-common')

/**
 */
class SKArrayStoreMem extends AsyncClass {
  /**
   */
  async init () {
    await super.init()

    this._data = []
  }

  /**
   */
  async clear () {
    this._data = []
  }

  /**
   */
  async insert (loc, hash) {
    const idx = this._idxSearch(loc)
    const item = this._data[idx]
    if (item && item.loc === loc) {
      item.set.add(hash)
      return
    }
    const set = new Set()
    set.add(hash)
    this._data.splice(idx, 0, {
      loc,
      set
    })
  }

  /**
   */
  async keys () {
    return this._data.map(i => i.loc)
  }

  /**
   */
  async remove (loc, hash) {
    const idx = this._idxSearch(loc)
    const item = this._data[idx]
    if (item && item.loc === loc) {
      item.set.delete(hash)
      if (item.set.size === 0) {
        this._data.splice(idx, 1)
      }
    }
  }

  /**
   */
  async get (loc) {
    const idx = this._idxSearch(loc)
    const item = this._data[idx]
    if (item && item.loc === loc) {
      return item.set.values()
    }
    return (new Set()).values()
  }

  /**
   */
  async getHashList (startLoc, maxLoc, maxHashes) {
    let maxOk = true
    if (maxLoc <= startLoc) {
      maxOk = false
    }

    maxHashes || (maxHashes = 0)
    const out = {
      startLoc: startLoc || 0,
      endLoc: null,
      hashSet: new Set()
    }

    let idx = this._idxSearch(out.startLoc)
    for (let count = 0; count < this._data.length; ++count) {
      const item = this._data[idx]

      if (maxHashes > 0 && out.hashSet.size + item.set.size > maxHashes) {
        return out
      }
      if (maxOk && item.loc > maxLoc) {
        return out
      }

      out.endLoc = item.loc

      for (let h of item.set) {
        out.hashSet.add(h)
      }

      ++idx
      if (idx >= this._data.length) {
        if (maxLoc > startLoc) {
          return out
        }
        idx = 0
        maxOk = true
      }
    }

    return out
  }

  // -- private -- //

  /**
   * returns the index of the first item that is >= loc
   */
  _idxSearch (loc) {
    // this is a naive linear implementation, just to get us going
    let idx = 0
    for (; idx < this._data.length; ++idx) {
      if (this._data[idx].loc >= loc) {
        return idx
      }
    }
    return idx
  }
}

exports.SKArrayStoreMem = SKArrayStoreMem
