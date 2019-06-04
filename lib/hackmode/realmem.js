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
    // Map of: (loc -> (entryAddress -> [{aspectAddress, json: JSON(entryAspect)}]))
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
   * Insert an entryAspect
   * @returns {boolean} - return true on successful insertion
   */
  insert (entryAspect) {
    if (!entryAspect || typeof entryAspect.entryAddress !== 'string' || !entryAspect.entryAddress.length) {
      throw new Error('cannot insert entryAspect without entryAddress field')
    }
    if (typeof entryAspect.address !== 'string' || !entryAspect.address.length) {
      throw new Error('cannot insert entryAspect without address field')
    }
    // get current entry at address or create empty entry
    const aspectList = this.get(entryAspect.entryAddress)
    const strData = JSON.stringify(entryAspect)

    let found = false
    for (let aspect of aspectList) {
      // exit if aspect is same from previously stored aspect
      if (aspect.json === strData) {
        return false
      }
      // update it if aspect is stored but different
      if (aspect.address === entryAspect.address) {
        aspect.json = strData
        found = true
        break
      }
    }
    // otherwise add it
    if (!found) {
      aspectList.push({
        address: entryAspect.address, json: strData
      })
    }
    this._genLocHashes()
    this._publishIndex(entryAspect)
    return true
  }

  // /**
  //  * Insert a dhtMeta
  //  * @param data
  //  * @returns {boolean} - return true on successful insertion
  //  */
  // insertMeta (dhtMeta) {
  //   // check pre-conditions
  //   if (!dhtMeta || typeof dhtMeta.entryAddress !== 'string' || !dhtMeta.entryAddress.length) {
  //     throw new Error('cannot insert dhtMeta without string entryAddress')
  //   }
  //   // get current entry at address or create empty entry
  //   const entry = this._getEntry(dhtMeta.entryAddress)
  //   const strData = JSON.stringify(dhtMeta)
  //   // create hash of metadata
  //   const hash = getHash(strData)
  //   if (entry.meta.has(hash)) {
  //     return false
  //   }
  //   // add meta to entry's meta Map
  //   entry.meta.set(hash, strData)
  //   this._genLocHashes()
  //   this._publishIndex(dhtMeta)
  //   return true
  // }

  /**
   *
   * @param entryAddress
   * @returns {bool} True if Mem holds data for that entry address
   */
  has (entryAddress, aspectAddress) {
    const loc = getLoc(entryAddress)
    if (!this._data.has(loc)) {
      return false
    }
    const aspectList = this.get(entryAddress)
    let found = aspectList.find(function (aspect) {
      return aspect.address === aspectAddress
    })
    return found !== undefined
  }

  /**
   *
   * @param entryAddress
   * @returns [{address: String, json: String}]
   */
  get (entryAddress) {
    const loc = getLoc(entryAddress)
    // create new loc on first address in this loc
    if (!this._data.has(loc)) {
      this._data.set(loc, new Map())
    }
    // if loc does not have address, create empty Entry for this address
    const ref = this._data.get(loc)
    if (!ref.has(entryAddress)) {
      ref.set(entryAddress, [])
    }
    return ref.get(entryAddress)
  }

  /**
   * Get list of aspects for an entry address
   * @private
   * @param entryAddress
   * @returns [{address: String, json: String}]
   */
  getAspect (entryAddress, aspectAddress) {
    const aspectList = this.get(entryAddress)
    let found = aspectList.find(function (aspect) {
      return aspect.address === aspectAddress
    })
    if (found) {
      return JSON.parse(found.json)
    }
  }

  // Map of: (loc -> (entryAddress -> [{aspectAddress, json: JSON(entryAspect)}]))

  /**
   * Regenerate _locHashes
   * (Called after every insert)
   * we need a way to generate consistent hashes
   * (that is, work around insertion order)
   */
  _genLocHashes () {
    // clear all previously stored hashes
    this._locHashes = {}
    // For each loc ...
    for (let [loc, entryMap] of this._data) {
      // .. agregate all data ...
      const locData = []
      const entryAddressList = Array.from(entryMap.keys()).sort()
      for (let entryAddress of entryAddressList) {
        const entryList = []
        const aspectList = entryMap.get(entryAddress)
        aspectList.sort()
        for (let aspect of aspectList) {
          entryList.push(aspect)
        }
        locData.push([entryAddress, entryList])
      }
      // ... and store hash of agregate
      this._locHashes[loc] = getHash(JSON.stringify(locData))
    }
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
