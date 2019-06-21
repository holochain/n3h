const crypto = require('crypto')
const tweetlog = require('../tweetlog/index')
const log = tweetlog('@mem@')

/**
 * Get a loc out of an entryAddress
 * bit of a hack, treat the entryAddress as utf8,
 * then xor into a single byte
 */
const getLoc = exports.getLoc = function getLoc (entryAddress) {
  const buf = Buffer.from(entryAddress, 'utf8')
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
    if (!entryAspect || typeof entryAspect.type !== 'string' || entryAspect.type !== 'entryAspect') {
      throw new Error('Can only insert data of type entryAspect')
    }
    if (typeof entryAspect.entryAddress !== 'string' || !entryAspect.entryAddress.length) {
      throw new Error('cannot insert entryAspect without entryAddress field')
    }
    if (typeof entryAspect.aspectAddress !== 'string' || !entryAspect.aspectAddress.length) {
      throw new Error('cannot insert entryAspect without aspectAddress field')
    }
    log.t('inserting entryAspect: ' + entryAspect.entryAddress + ' - ' + entryAspect.aspectAddress)
    // get current entry at entryAddress or create empty entry
    const entryAspectJson = JSON.stringify(entryAspect)
    const aspectList = this.get(entryAspect.entryAddress)
    let found = false
    for (let aspect of aspectList) {
      // known aspect: exit if aspect is same from previously stored aspect
      if (aspect.json === entryAspectJson) {
        return false
      }
      // different aspect: update it if aspect is stored but different
      // TODO: check publishTs and discard if its older?
      if (aspect.aspectAddress === entryAspect.aspectAddress) {
        aspect.json = entryAspectJson
        found = true
        break
      }
    }
    // new aspect: add it to entry's aspectList
    if (!found) {
      aspectList.push({
        aspectAddress: entryAspect.aspectAddress, json: entryAspectJson
      })
    }
    this._genLocHashes()
    this._publishIndex(entryAspect)
    return true
  }

  /**
   *
   * @param entryAddress
   * @returns {bool} True if Mem holds data for that entryAddress
   */
  has (entryAddress, aspectAddress) {
    // log.t('has entry? ' + entryAddress)
    const loc = getLoc(entryAddress)
    if (!this._data.has(loc)) {
      return false
    }
    if (aspectAddress === undefined) {
      return true
    }
    // log.t('has aspect? ' + aspectAddress)
    const aspectList = this.get(entryAddress)
    let found = aspectList.find(function (aspect) {
      return aspect.aspectAddress === aspectAddress
    })
    return found !== undefined
  }

  /**
   *
   * @param entryAddress
   * @returns [{aspectAddress: String, json: String}]
   */
  get (entryAddress) {
    const loc = getLoc(entryAddress)
    // create new loc on first entryAddress in this loc
    if (!this._data.has(loc)) {
      this._data.set(loc, new Map())
    }
    // if loc does not have entryAddress, create empty Entry for this entryAddress
    const ref = this._data.get(loc)
    if (!ref.has(entryAddress)) {
      ref.set(entryAddress, [])
    }
    return ref.get(entryAddress)
  }

  /**
   * Get list of aspects for an entryAddress
   * @private
   * @param entryAddress
   * @returns [{aspectAddress: String, json: String}]
   */
  getAspect (entryAddress, aspectAddress) {
    const aspectList = this.get(entryAddress)
    let found = aspectList.find(function (aspect) {
      return aspect.aspectAddress === aspectAddress
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
