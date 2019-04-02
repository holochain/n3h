const crypto = require('crypto')

/**
 * Get a loc out of an address
 * bit of a hack, treat the address as utf8,
 * then xor into a single byte
 */
const getLoc = exports.getLoc = function getLoc (address) {
  const buf = Buffer.from(address, 'utf8')
  let loc = buf.readInt8(0)
  for (let i = 1; i < buf.byteLength; ++i) {
    loc = loc ^ buf.readInt8(i)
  }
  return loc.toString(16)
}

/**
 * Hash a string and output b64
 */
const getHash = exports.getHash = function getHash (str) {
  const hasher = crypto.createHash('sha256')
  hasher.update(Buffer.from(str, 'utf8'))
  return hasher.digest().toString('base64')
}

/**
 */
class RealMem {
  constructor () {
    // Map of: loc -> (entryHash -> [entryContent, (metaHash -> metaContent))])
    this._data = new Map()
    this._indexers = []
    // Object of: loc -> dataBlobHash
    this._locHashes = {}
  }

  registerIndexer (fn) {
    const store = {}
    this._indexers.push([store, fn])
    return store
  }

  /**
   * Insert a dhtEntry
   * @returns {boolean} - return true on successful insertion
   */
  insert (dhtEntry) {
    if (!dhtEntry || typeof dhtEntry.address !== 'string' || !dhtEntry.address.length) {
      throw new Error('cannot insert dhtEntry without string address')
    }
    // get current entry at address or create empty entry
    const entry = this._getEntry(dhtEntry.address)
    const strData = JSON.stringify(dhtEntry)
    // exit if entry is same from previously stored entry
    if (entry.entry === strData) {
      return false
    }
    // otherwise update it
    entry.entry = strData
    this._genLocHashes()
    this._publishIndex(dhtEntry)
    return true
  }

  /**
   * Insert a dhtMeta
   * @param data
   * @returns {boolean} - return true on successful insertion
   */
  insertMeta (dhtMeta) {
    // check pre-conditions
    if (!dhtMeta || typeof dhtMeta.entryAddress !== 'string' || !dhtMeta.entryAddress.length) {
      throw new Error('cannot insert dhtMeta without string entryAddress')
    }
    // get current entry at address or create empty entry
    const entry = this._getEntry(dhtMeta.entryAddress)
    const strData = JSON.stringify(dhtMeta)
    // create hash of metadata
    const hash = getHash(strData)
    if (entry.meta.has(hash)) {
      return false
    }
    // add meta to entry's meta Map
    entry.meta.set(hash, strData)
    this._genLocHashes()
    this._publishIndex(dhtMeta)
    return true
  }

  /**
   *
   * @param entryAddress
   * @returns {bool} True if Mem holds data for that address
   */
  has (entryAddress) {
    const loc = getLoc(entryAddress)
    if (!this._data.has(loc)) {
      return false
    }
    const ref = this._data.get(loc)
    return ref.has(entryAddress)
  }

  /**
   *
   * @param entryAddress
   * @returns {{entry: any, meta: Array}}
   */
  get (entryAddress) {
    const loc = getLoc(entryAddress)
    if (!this._data.has(loc)) {
      return
    }
    const ref = this._data.get(loc)
    if (ref.has(entryAddress)) {
      const entry = ref.get(entryAddress)
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

  /**
   * Regenerate _locHashes
   * (Called after every insert)
   * we need a way to generate consistent hashes
   * (that is, work around insertion order)
   */
  _genLocHashes () {
    // clear
    this._locHashes = {}
    // compute and store hash of data agregate of each stored loc
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

  /**
   * Get data for an entry
   * @private
   * @param address
   * @returns {{entry: any, meta: Array}}
   */
  _getEntry (entryAddress) {
    const loc = getLoc(entryAddress)
    // create new loc on first address in this loc
    if (!this._data.has(loc)) {
      this._data.set(loc, new Map())
    }
    // if loc does not have address, create empty Entry for this address
    const ref = this._data.get(loc)
    if (!ref.has(entryAddress)) {
      ref.set(entryAddress, {
        entry: '{}',
        meta: new Map()
      })
    }
    return ref.get(entryAddress)
  }

  /**
   * Run indexers
   * @private
   */
  _publishIndex (data) {
    for (let idx of this._indexers) {
      idx[1](idx[0], data)
    }
  }
}

exports.RealMem = RealMem
exports.getHash = getHash
