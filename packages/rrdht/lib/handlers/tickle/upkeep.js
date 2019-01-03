// probably need some more robust timing handlers
// for now, just upkeep every 100 ms
async function upkeep (config, action, params) {
  const _ = config._

  if (!_.scanPeers || _.scanPeers.length < 1) {
    _.scanPeers = await _.rangeStore.getNeighborhoodPeers()
  }

  if (!_.curScanPeer) {
    _.curScanPeer = _.scanPeers.shift()
    console.log('@@', _.curScanPeer)
  }
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('tickle', upkeep)
}
