const range = require('./range')
const rFactory = range.rFactory(-2147483648, 2147483647)

class RangeStore {
  constructor (config, loc, radius) {
    this._loc = loc
    this._config = config
    this._radius = radius

    this._range = rFactory.fromRadius(this._loc, this._radius)
    console.log(range.rAsciiArt(this._range))
  }
}

exports.RangeStore = RangeStore
