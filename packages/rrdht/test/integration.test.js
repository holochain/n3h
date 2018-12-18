const crypto = require('crypto')

const { expect } = require('chai')
const { $sleep } = require('@holochain/n3h-common')

const {
  // defaultConfig,
  // range,
  RRDht,
  actions
  // events
} = require('../lib/index')

const WORK_TARGET = Buffer.from('00000000000000000000000000000000000000000000000000000000000000ff', 'hex').toString('base64')

describe('RRDht Integration Suite', () => {
  const nodes = []

  beforeEach(async () => {
    const agentHash = crypto.randomBytes(32).toString('base64')

    for (let i = 0; i < 1; ++i) {
      const node = await new RRDht({
        agentLocWorkTarget: WORK_TARGET,
        agentHash,
        agentNonce: 'b+OXWcbfUO/eq3wmPk/RYjUWheTC/V/t+EqfIaUDJvU=',
        agentPeerInfo: {
          testId: i
        }
      })
      const events = []
      node.on('all', async evt => events.push(evt))
      nodes.push({
        node,
        events
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
    for (;;) {
      if (nodes[0].events.length > 0) {
        const evt = nodes[0].events.shift()
        if (evt.type === 'peerHoldRequest') {
          expect(evt.peerInfo.testId).equals('fake')
          return
        }
      }
      await $sleep(10)
    }
  })
})
