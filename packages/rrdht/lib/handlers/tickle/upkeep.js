async function upkeep (config, action, params) {
  console.log('@@', JSON.stringify(config._, null, 2))
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('tickle', upkeep)
}
