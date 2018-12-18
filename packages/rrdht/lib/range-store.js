const range = require('./range')
const { AsyncClass } = require('@holochain/n3h-common')

/**
 */
class RangeStore extends AsyncClass {
  /**
   */
  async init (config, loc, radius) {
    await super.init()

    this._config = config

    this._byHash = await config.persistCacheProxy('storeByHash')
    this._byLoc = new Map()
    await this._populateLoc()

    await this.setRadius(loc, radius)
  }

  /**
   */
  async setRadius (loc, radius) {
    this._range = range.rFromRadius(loc, radius)
    await this._prune()
  }

  /**
   */
  wouldStore (loc) {
    return range.rCoversPoint(this._range, loc)
  }

  /**
   */
  async mayStorePeer (loc, hash, nonce, meta) {
    if (this.wouldStore(loc)) {
      this._byHash[hash].set(JSON.stringify({
        type: 'peer',
        loc,
        hash,
        nonce,
        meta
      }))
      this._locAddHash(loc, hash)
    }
  }

  /**
   */
  async mayStoreData (loc, hash, meta) {
    if (this.wouldStore(loc)) {
      this._byHash[hash].set(JSON.stringify({
        type: 'data',
        loc,
        hash,
        meta
      }))
      this._locAddHash(loc, hash)
    }
  }

  /**
   */
  async getHash (hash) {
    let out = await this._byHash[hash]()
    if (out) {
      out = JSON.parse(out)
    }
    if (out && out.meta) {
      return out.meta
    }
  }

  // -- private -- //

  /**
   */
  _locAddHash (loc, hash) {
    if (!this._byLoc.has(loc)) {
      this._byLoc.set(loc, new Set())
    }
    this._byLoc.get(loc).add(hash)
  }

  /**
   */
  _locRemHash (loc, hash) {
    if (!this._byLoc.has(loc)) {
      return
    }
    this._byLoc.get(loc).delete(hash)
  }

  /**
   */
  async _populateLoc () {
    const keys = await this._config.persistCacheKeys('storeByHash')
    for (let key of keys) {
      const entry = JSON.parse(await this._byHash[key]())
      this._locAddHash(entry.loc, entry.hash)
    }
  }

  /**
   */
  async _prune () {
    for (let [loc, hashList] of this._byLoc) {
      if (!this.wouldStore(loc)) {
        for (let hash of hashList) {
          this._byHash[hash].remove()
        }
        this._byLoc.delete(loc)
      }
    }
  }
}

exports.RangeStore = RangeStore
