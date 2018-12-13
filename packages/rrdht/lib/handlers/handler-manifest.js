const handlers = [
  require('./init/init'),
  require('./tickle/upkeep'),
  require('./register-peer/register-peer')
]

exports.registerHandler = function registerHandler (config) {
  for (let handler of handlers) {
    handler.registerHandler(config)
  }
}
