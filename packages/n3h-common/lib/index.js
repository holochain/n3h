exports.AsyncClass = require('./async-class').AsyncClass
exports.$p = require('./promisify').$p
exports.$sleep = require('./sleep').$sleep
exports.mkdirp = require('./mkdirp').mkdirp
exports.ModMod = require('./modmod').ModMod
exports.createEventSpec = require('./event').createEventSpec
exports.Executor = require('./exec').Executor
exports.Track = require('./track').Track
exports.type = require('./type')

const rejectionHandler = {
  state: false,
  fn: err => {
    console.error('Strict Fail on Unhandled Promise Rejection')
    console.error(err)
    process.exit(1)
  }
}
exports.unhandledRejection = {
  strict: () => {
    if (!rejectionHandler.state) {
      process.on('unhandledRejection', rejectionHandler.fn)
      rejectionHandler.state = true
    }
  },
  relaxed: () => {
    process.off('unhandledRejection', rejectionHandler.fn)
    rejectionHandler.state = false
  }
}
