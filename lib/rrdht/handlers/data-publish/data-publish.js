const events = require('../../events')
const msgpack = require('msgpack-lite')

async function dataPublish (config, action, params) {
  const loc = await config.dataLocFn(params.dataHash)

  // see if we should store it locally
  await config._.rangeStore.mayStoreData(loc, params.dataHash)

  console.log('dataPublish', params.dataHash, loc)

  const publishPeers = await config._.rangeStore.getPeersForLoc(loc)

  const bundle = msgpack.encode([
    'dataPublish',
    Buffer.from(params.dataHash, 'base64'),
    Buffer.from(params.data, 'base64')
  ]).toString('base64')

  if (publishPeers.length > 0) {
    const evt = events.unreliableGossipBroadcast(publishPeers, bundle)
    await config.emit(evt)
  } else {
    // XXX TODO - we need to do a peer discovery run first
    throw new Error('no peers conneted that will hold this data!!')
  }
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('dataPublish', dataPublish)
}
