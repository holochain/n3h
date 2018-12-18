const crypto = require('crypto')

const { expect } = require('chai')
const { $sleep } = require('@holochain/n3h-common')

const {
  defaultConfig,
  // range,
  RRDht,
  actions
  // events
} = require('../lib/index')

const WORK_TARGET = Buffer.from('00000000000000000000000000000000000000000000000000000000000000ff', 'hex').toString('base64')

describe('RRDht Integration Suite', () => {
  let preConf = null

  const nodes = []

  before(async () => {
    preConf = await (defaultConfig.generateConfigBuilder()
      .attach({
        agentLocWorkTarget: WORK_TARGET
      })
      .finalize())
  })

  beforeEach(async () => {
    const agentHash = crypto.randomBytes(32).toString('base64')
    const agentNonce = await preConf.agentLocSearchFn(agentHash)

    for (let i = 0; i < 1; ++i) {
      const node = await new RRDht({
        agentLocWorkTarget: WORK_TARGET,
        agentHash,
        agentNonce,
        agentPeerInfo: {
          testId: i
        }
      })
      const events = []
      node.on('all', async evt => events.push(evt))
      nodes.push({
        node,
        events,
        wait: async predicate => {
          const start = Date.now()
          for (;;) {
            if (events.length) {
              const evt = events.shift()
              if (await predicate(evt)) {
                return evt
              }
            }
            if (Date.now() - start > 5000) {
              throw new Error('event wait timeout')
            }
            await $sleep(10)
          }
        }
      })
    }
  })

  afterEach(async () => {
    for (let node of nodes) {
      await node.node.destroy()
    }
    nodes.splice(0, nodes.length)
  })

  it('should emit a peerHoldRequest', async () => {
    nodes[0].node.act(actions.peerHoldRequest('my-hash', 'nonce', {
      testId: 'fake'
    }))
    const evt = await nodes[0].wait(evt => evt.type === 'peerHoldRequest')
    expect(evt.peerInfo.testId).equals('fake')
  })
})
