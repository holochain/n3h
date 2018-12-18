const events = require('../../events')

async function peerHoldRequest (config, action, params) {
  // const _ = config._

  await config.emit(events.peerHoldRequest(
    params.peerHash, params.peerNonce, params.peerInfo))
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('peerHoldRequest', peerHoldRequest)
}
