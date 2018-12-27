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
    this._byLoc = await config.getSKArrayStore('storeByLoc')

    // trust our full data store, clear and re-index loc lookups
    await this._byLoc.clear()
    await this._populateLoc()

    await this.setRadius(loc, radius)
  }

  /**
   */
  async setRadius (loc, radius) {
    if (typeof loc !== 'number' || typeof radius !== 'number') {
      throw new Error('setRadius takes two number values')
    }
    this._range = range.rFromRadius(loc, radius)
    await this._prune()
  }

  /**
   */
  wouldStore (loc) {
    if (typeof loc !== 'number') {
      throw new Error('wouldStore takes a number value')
    }
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
      this._byLoc.insert(loc, hash)
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
      this._byLoc.insert(loc, hash)
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

  /**
   */
  async getHashList (startLoc, maxLoc, maxHashes) {
    return this._byLoc.getHashList(startLoc, maxLoc, maxHashes)
  }

  // -- private -- //

  /**
   */
  async _populateLoc () {
    const p = await this._config.getPersistCache('storeByHash')
    const keys = await p.keys()
    for (let key of keys) {
      const entry = JSON.parse(await this._byHash[key]())
      this._byLoc.insert(entry.loc, entry.hash)
    }
  }

  /**
   */
  async _prune () {
    for (let loc of await this._byLoc.keys()) {
      const hashList = await this._byLoc.get(loc)
      if (!this.wouldStore(loc)) {
        for (let hash of hashList) {
          this._byHash[hash].remove()
          this._byLoc.remove(loc, hash)
        }
      }
    }
  }
}

exports.RangeStore = RangeStore
