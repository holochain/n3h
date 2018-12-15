async function init (config, action, params) {
  const $ = config.$
  const _ = config._
  const cacheLoc = await $.agentLoc()
  if (cacheLoc && cacheLoc !== config.agentLoc) {
    throw new Error('initializing cache with different agent, aborting')
  }
  await $.agentLoc(config.agentLoc)

  // hard-coding radii for now
  _.radii = {
    hold: (0xffffffff / 8) | 0,
    query: (0xffffffff / 4) | 0
  }

  console.log('init', config.agentHash, '@', config.agentLoc)
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('init', init)
}
