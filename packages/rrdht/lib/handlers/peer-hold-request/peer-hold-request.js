const events = require('../../events')

async function peerHoldRequest (config, action, params) {
  // const loc = await config.agentLocFn(params.peerHash, params.peerNonce)
  // console.log('zombies', loc, config._.rangeStore.wouldStore(loc))

  await config.emit(events.peerHoldRequest(
    params.peerHash, params.peerNonce, params.peerInfo))
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('peerHoldRequest', peerHoldRequest)
}
