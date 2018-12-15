const handlers = [
  require('./init/init'),
  require('./tickle/upkeep'),
  require('./register-peer/register-peer')
]

exports.registerHandler = async function registerHandler (config) {
  for (let handler of handlers) {
    await handler.registerHandler(config)
  }
}
