/*
 * SK = sorted key
 * sorted int32 keys index into arrays of hashes
 * used for looking up hashes based on int32 locations
 * this is an in-memory store,
 * please use a disk persisted option for production solutions
 */

const { AsyncClass } = require('@holochain/n3h-common')

const RE_LOC = /^[a-f0-9]{8}$/
function assertLoc (l) {
  if (typeof l !== 'string' || !RE_LOC.test(l)) {
    throw new Error('loc must be 8 hex characters')
  }
  return parseInt(l, 16)
}

function assertNumLoc (l) {
  if (typeof l !== 'number' || l < 0 || l > 0xffffffff) {
    throw new Error('internal loc must be uint32')
  }
}

function renderLoc (l) {
  assertNumLoc(l)
  return l.toString(16).padStart(8, '0')
}

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
  async keys () {
    return this._data.map(i => renderLoc(i.loc))
  }

  /**
   */
  async insert (loc, hash) {
    return this._insert(assertLoc(loc), hash)
  }

  /**
   */
  async remove (loc, hash) {
    return this._remove(assertLoc(loc), hash)
  }

  /**
   */
  async get (loc) {
    return this._get(assertLoc(loc))
  }

  /**
   */
  async getHashList (startLoc, maxLoc, maxHashes) {
    startLoc = assertLoc(startLoc)
    maxLoc = assertLoc(maxLoc)

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

    const renderOut = () => {
      out.startLoc = renderLoc(out.startLoc)
      out.endLoc = renderLoc(out.endLoc)
      return out
    }

    let idx = this._idxSearch(out.startLoc)
    if (idx >= this._data.length) {
      idx = 0
      maxOk = true
    }
    for (let count = 0; count < this._data.length; ++count) {
      // console.error('@@', idx, this._data)
      const item = this._data[idx]

      if (maxHashes > 0 && out.hashSet.size + item.set.size > maxHashes) {
        return renderOut(out)
      }
      if (maxOk && item.loc > maxLoc) {
        return renderOut(out)
      }

      out.endLoc = item.loc

      for (let h of item.set) {
        out.hashSet.add(h)
      }

      ++idx
      if (idx >= this._data.length) {
        if (maxLoc > startLoc) {
          return renderOut(out)
        }
        idx = 0
        maxOk = true
      }
    }

    return renderOut(out)
  }

  // -- private -- //

  async _insert (loc, hash) {
    assertNumLoc(loc)
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

  async _remove (loc, hash) {
    assertNumLoc(loc)
    const idx = this._idxSearch(loc)
    const item = this._data[idx]
    if (item && item.loc === loc) {
      item.set.delete(hash)
      if (item.set.size === 0) {
        this._data.splice(idx, 1)
      }
    }
  }

  _get (loc) {
    assertNumLoc(loc)
    const idx = this._idxSearch(loc)
    const item = this._data[idx]
    if (item && item.loc === loc) {
      return item.set.values()
    }
    return (new Set()).values()
  }

  /**
   * returns the index of the first item that is >= loc
   */
  _idxSearch (loc) {
    assertNumLoc(loc)

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
