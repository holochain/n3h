const range = require('./range')

class RangeStore {
  constructor (config, loc, radius) {
    this._loc = loc
    this._config = config
    this._radius = radius

    this._range = range.rFromRadius(this._loc, this._radius)
    console.log(range.rAsciiArt(this._range))
  }
}

exports.RangeStore = RangeStore
