const crypto = require('crypto')

// bit of a hack, treat the address as utf8,
// then xor into a single byte
const getLoc = exports.getLoc = function getLoc (address) {
  const buf = Buffer.from(address, 'utf8')
  let loc = buf.readInt8(0)
  for (let i = 1; i < buf.byteLength; ++i) {
    loc = loc ^ buf.readInt8(i)
  }
  return loc.toString(16)
}

const getHash = exports.getHash = function getHash (str) {
  const hasher = crypto.createHash('sha256')
  hasher.update(Buffer.from(str, 'utf8'))
  return hasher.digest().toString('base64')
}

/**
 * _data is datastore of
 * Map(loc, Map(entryHash, (entryContent, meta:Map(metaHash, metaContent))))
 */
class Mem {
  constructor () {
    this._data = new Map()
    this._indexers = []
    this._locHashes = {}
  }

  registerIndexer (fn) {
    const store = {}
    this._indexers.push([store, fn])
    return store
  }

  /**
   * Called at every insert.
   * we need a way to generate consistent hashes
   * (that is, work around insertion order)
   */
  _genLocHashes () {
    this._locHashes = {}
    for (let [loc, sub] of this._data) {
      const locData = []

      const addrs = Array.from(sub.keys()).sort()
      for (let addr of addrs) {
        const entry = sub.get(addr)
        const meta = []

        const metaHashes = Array.from(entry.meta.keys()).sort()
        for (let metaHash of metaHashes) {
          const metaItem = entry.meta.get(metaHash)
          meta.push([metaHash, metaItem])
        }

        locData.push([addr, entry.entry, meta])
      }

      this._locHashes[loc] = getHash(JSON.stringify(locData))
    }
  }

  _getEntry (address) {
    const loc = getLoc(address)
    // create new loc on first address in this loc
    if (!this._data.has(loc)) {
      this._data.set(loc, new Map())
    }
    // if loc does not have address, create empty Entry for this address
    const ref = this._data.get(loc)
    if (!ref.has(address)) {
      ref.set(address, {
        entry: '{}',
        meta: new Map()
      })
    }
    return ref.get(address)
  }

  _publishIndex (data) {
    for (let idx of this._indexers) {
      idx[1](idx[0], data)
    }
  }

  /**
   *  Insert a dhtEntry
   * @returns {boolean} - return true on successful insertion
   */
  insert (data) {
    if (!data || typeof data.address !== 'string' || !data.address.length) {
      throw new Error('cannot insert dhtEntry without string address')
    }
    // get current entry at address or create empty entry
    const entry = this._getEntry(data.address)
    const strData = JSON.stringify(data)
    // if entry is different from previously stored entry, update it
    if (entry.entry !== strData) {
      entry.entry = strData
      this._genLocHashes()
      this._publishIndex(data)
      return true
    }
    return false
  }

  /**
   * Insert a dhtMeta
   * @param data
   * @returns {boolean} - return true on successful insertion
   */
  insertMeta (data) {
    if (!data || typeof data.entryAddress !== 'string' || !data.entryAddress.length) {
      throw new Error('cannot insert dhtMeta without string address')
    }
    // get current entry at address or create empty entry
    const entry = this._getEntry(data.entryAddress)
    const strData = JSON.stringify(data)
    // create hash of metadata
    const hash = getHash(strData)
    // add meta to entry's meta Map
    if (!entry.meta.has(hash)) {
      entry.meta.set(hash, strData)
      this._genLocHashes()
      this._publishIndex(data)
      return true
    }
    return false
  }

  has (address) {
    const loc = getLoc(address)
    if (!this._data.has(loc)) {
      return false
    }
    const ref = this._data.get(loc)
    if (ref.has(address)) {
      return true
    }
    return false
  }

  get (address) {
    const loc = getLoc(address)
    if (!this._data.has(loc)) {
      return
    }
    const ref = this._data.get(loc)
    if (ref.has(address)) {
      const entry = ref.get(address)
      const out = {
        entry: JSON.parse(entry.entry),
        meta: []
      }
      for (let metaItem of entry.meta.values()) {
        out.meta.push(JSON.parse(metaItem))
      }
      return out
    }
  }

  toJSON () {
    const out = {}
    for (let sub of this._data.values()) {
      for (let addr of sub.keys()) {
        out[addr] = this.get(addr)
      }
    }
    return out
  }

  getGossipHashHash () {
    return JSON.parse(JSON.stringify(this._locHashes))
  }

  getGossipLocListForGossipHashHash (gossipHashHash) {
    const out = []
    for (let loc in gossipHashHash) {
      if (loc in this._locHashes) {
        if (gossipHashHash[loc] !== this._locHashes[loc]) {
          out.push(loc)
        }
      } else {
        out.push(loc)
      }
    }
    return out
  }

  getGossipHashesForGossipLocList (gossipLocList) {
    const out = []
    for (let loc of gossipLocList) {
      if (this._data.has(loc)) {
        for (let addr of this._data.get(loc).keys()) {
          out.push(addr)
        }
      }
    }
    return out
  }
}

exports.Mem = Mem
exports.getHash = getHash
