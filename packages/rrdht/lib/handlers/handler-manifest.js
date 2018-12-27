const handlers = [
  require('./init/init'),
  require('./tickle/upkeep'),
  require('./peer-hold-request/peer-hold-request'),
  require('./data-publish/data-publish')
]

exports.registerHandler = async function registerHandler (config) {
  for (let handler of handlers) {
    await handler.registerHandler(config)
  }
}
