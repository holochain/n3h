const crypto = require('crypto')

/**
 * get loc out of a hash
 */
const getLoc = exports.getLoc = function getLoc (hash) {
  let loc = hash.readInt8(0)
  for (let i = 1; i < 32; i += 1) {
    loc = loc ^ hash.readInt8(i)
  }
  const b = Buffer.alloc(1)
  b.writeInt8(loc, 0)
  return b.toString('hex')
}

/**
 *  hash a buffer
 */
const getHash = exports.getHash = function getHash (buffer) {
  const hasher = crypto.createHash('sha256')
  hasher.update(buffer)
  return hasher.digest()
}

/**
 * Make a Mem.Entry out of some json data.
 * Mem.Entry is: (buffer, hash, loc)
 */
const getEntry = exports.getEntry = function getEntry (data) {
  const buffer = Buffer.from(JSON.stringify(data), 'utf8')
  const hash = getHash(buffer)
  return {
    loc: getLoc(hash),
    hash: hash.toString('base64'),
    buffer
  }
}

/**
 * Object for storing & retrieving json data.
 * Stored by hash and loc.
 */
class Mem {
  /**
   * Ctor
   */
  constructor () {
    this._data = {} // main datastore
    this._indexers = [] // array of indexers: store with an indexing function
  }

  /**
   * add an indexer
   * @param {function} fn - indexing function
   * @return {object} - the indexer's store
   */
  registerIndexer (fn) {
    const store = {}
    this._indexers.push([store, fn])
    return store
  }

  /**
   * Insert some json data in Mem.
   * Inserted data will go through each registered indexer.
   * @param {object} data - json data to store
   * @return {bool} - false if data was already inserted
   */
  insert (data) {
    // transform input into an entry
    const entry = getEntry(data)
    // create loc if first time this loc is used
    if (!(entry.loc in this._data)) {
      this._data[entry.loc] = {}
    }
    // check hash & loc integrity
    if (entry.hash in this._data[entry.loc]) {
      return false
    }
    // store entry
    this._data[entry.loc][entry.hash] = entry
    // index with each indexer by using its indexing function
    for (let idx of this._indexers) {
      idx[1](idx[0], entry.hash, data)
    }
    return true
  }

  /**
   *
   */
  has (hash) {
    const loc = getLoc(Buffer.from(hash, 'base64'))
    if (!(loc in this._data)) {
      return false
    }
    if (hash in this._data[loc]) {
      return true
    }
    return false
  }

  /**
   * return data from its hash
   */
  get (hash) {
    // get loc from hash
    const loc = getLoc(Buffer.from(hash, 'base64'))
    // make sure there this loc exists
    if (!(loc in this._data)) {
      return
    }
    // get data from its hash where it is stored (data[loc])
    if (hash in this._data[loc]) {
      // transform string buffer into json
      return JSON.parse(this._data[loc][hash].buffer.toString('utf8'))
    }
  }
}

exports.Mem = Mem
