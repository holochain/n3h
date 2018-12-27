// const events = require('../../events')

async function dataPublish (config, action, params) {
  const loc = await config.dataLocFn(params.dataHash)

  // see if we should store it locally
  await config._.rangeStore.mayStoreData(loc, params.dataHash)

  console.log('dataPublish', params.dataHash, loc)
  if (config._.rangeStore.wouldStore(loc)) {
    console.log('HOT DOG - need a way of getting peer list that should store this')
  }
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('dataPublish', dataPublish)
}
