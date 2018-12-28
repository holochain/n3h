const events = require('../../events')
const msgpack = require('msgpack-lite')

async function dataHoldRequest (config, action, params) {
  const loc = await config.dataLocFn(params.dataHash)

  await config._.rangeStore.mayStoreData(
    loc, params.dataHash)
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('dataHoldRequest', dataHoldRequest)
}
