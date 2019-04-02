const { RangeStore } = require('../../range-store')

async function init (config, action, params) {
  try {
    const $ = config.$
    const _ = config._
    const cacheLoc = await $.agentLoc()
    if (cacheLoc && cacheLoc !== config.agentLoc) {
      throw new Error('initializing cache with different agent, aborting')
    }
    await $.agentLoc(config.agentLoc)

    // hard-coding radii for now
    _.radii = {
      hold: (0xffffffff / 4) | 0,
      query: (0xffffffff / 2) | 0
    }

    _.rangeStore = await new RangeStore(config, config.agentLoc, _.radii.hold)

    console.log('init', config.agentHash, '@', config.agentLoc)

    _._waitInit.resolve()
  } catch (e) {
    if (config._._waitInit.reject) {
      config._._waitInit.reject(e)
    } else {
      console.error(e)
      process.exit(1)
    }
  }
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('init', init)
}
