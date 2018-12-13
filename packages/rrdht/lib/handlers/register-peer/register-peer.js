async function registerPeer (config, action, params) {
  await config.emit('action', action, params)
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('registerPeer', registerPeer)
}
