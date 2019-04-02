const events = require('../../events')
const msgpack = require('msgpack-lite')

async function remoteGossipBundle (config, action, params) {
  const bundle = msgpack.decode(Buffer.from(params.bundle, 'base64'))
  switch (bundle[0]) {
    case 'dataPublish': {
      const dataHash = bundle[1].toString('base64')
      const data = bundle[2].toString('base64')
      await config.emit(events.dataHoldRequest(dataHash, data))
      break
    }
    case 'dataQuery': {
      const msgId = bundle[1]
      const agentHash = bundle[2].toString('base64')
      const dataHash = bundle[3].toString('base64')

      const locMsgId = await config.getMsgId()
      const hp = config.registerWaitHandler(locMsgId)
      await config.emit(events.dataFetch(dataHash, locMsgId))

      // we need to let the action queue loop continue
      // don't await this in-line
      setImmediate(async () => {
        try {
          const res = await hp
          console.log('@@ local fetch response:', res)
          if (res && res.data) {
            const bundle = msgpack.encode([
              'dataQueryResponse',
              msgId,
              Buffer.from(res.data, 'base64')
            ]).toString('base64')
            const peer = await config._.rangeStore.getHash(agentHash)
            if (peer) {
              await config.emit(events.gossipTo(
                JSON.stringify(peer), bundle))
            } else {
              throw new Error('how can we not know about a peer we received a message from? ' + agentHash)
            }
          }
        } catch (e) {
          // uhh... how to handle async exceptions??
          console.error(e)
          process.exit(1)
        }
      })
      break
    }
    default:
      throw new Error('unhandled gossip type ' + bundle[0])
  }
}

exports.registerHandler = function registerHandler (config) {
  config.registerHandler('remoteGossipBundle', remoteGossipBundle)
}
