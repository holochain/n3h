const events = require('../../events')
const msgpack = require('msgpack-lite')

async function remoteGossipBundle (config, action, params) {
  const bundle = msgpack.decode(Buffer.from(params.bundle, 'base64'))
  switch (bundle[0]) {
    case 'dataPublish':
      const dataHash = bundle[1].toString('base64')
      const data = bundle[2].toString('base64')
      await config.emit(events.dataHoldRequest(dataHash, data))
      break
    default:
      throw new Error('unhandled gossip type ' + bundle[0])
  }
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('remoteGossipBundle', remoteGossipBundle)
}
