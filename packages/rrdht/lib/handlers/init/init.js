async function init (config, action, params) {
  const cacheLoc = await config.persistCacheGet(config, '$', 'agentLoc')
  if (cacheLoc && cacheLoc !== config.agentLoc) {
    throw new Error('initializing cache with different agent, aborting')
  }
  await config.persistCacheSet(config, '$', 'agentLoc', config.agentLoc)
  console.log('init', config.agentHash, '@', config.agentLoc)
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('init', init)
}
