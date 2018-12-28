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
    this._extraPeerRefs = await config.persistCacheProxy('storeExtraPeerRefs')

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
  async mayStorePeer (loc, hash, nonce, radii) {
    if (this.wouldStore(loc)) {
      this._byHash[hash].set(JSON.stringify({
        type: 'peer',
        loc,
        hash,
        nonce,
        radii
      }))
      this._byLoc.insert(loc, hash)
      console.log(this._range, 'store peer', loc, radii)
    } else {
      // for now, we just keep 20 of the newest extra peer refs
      let nextIdx = await this._extraPeerRefs.nextIdx()
      if (typeof nextIdx !== 'string') {
        nextIdx = '0'
        await this._extraPeerRefs.nextIdx.set(nextIdx)
      }
      nextIdx = parseInt(nextIdx, 10)
      let n = nextIdx + 1
      if (n > 19) {
        n = 0
      }
      await this._extraPeerRefs.nextIdx.set(n.toString())
      const idx = 'peer-' + nextIdx
      this._extraPeerRefs[idx].set(JSON.stringify({
        type: 'peer',
        loc,
        hash,
        nonce,
        radii
      }))
      console.log(this._range, 'store extra', '(' + idx + ')', loc, radii)
    }
  }

  /**
   */
  async mayStoreData (loc, hash) {
    if (this.wouldStore(loc)) {
      this._byHash[hash].set(JSON.stringify({
        type: 'data',
        loc,
        hash
      }))
      this._byLoc.insert(loc, hash)
      console.log('store data', loc, hash)
    }
  }

  /**
   */
  async getPeersForPublishLoc (loc) {
    // right now, search through the whole peerbook (including extraRefs)
    // someday we'll need to index this properly
    // since publish should be a less frequent operation,
    // right now we are optimized for gossip

    const out = []

    const check = json => {
      json = JSON.parse(json)
      if (json.type !== 'peer') {
        return
      }
      if (!json.radii) {
        throw new Error(JSON.stringify(json))
      }
      const covers = range.rCoversPoint(range.rFromRadiiHold(json.radii), loc)
      if (covers) {
        out.push(json)
      }
    }

    const wait = []

    const p = await this._config.getPersistCache()
    const keys = await p.keys('storeByHash')
    for (let hash of keys) {
      wait.push((async () => {
        check(await this._byHash[hash]())
      })())
    }

    for (let i = 0; i < 20; ++i) {
      wait.push((async () => {
        const d = await this._extraPeerRefs['peer-' + i]()
        if (d) {
          check(d)
        }
      })())
    }

    await Promise.all(wait)
    return out
  }

  /**
   */
  async getHash (hash) {
    let out = await this._byHash[hash]()
    if (out) {
      return JSON.parse(out)
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
    const p = await this._config.getPersistCache()
    const keys = await p.keys('storeByHash')
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
