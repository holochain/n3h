// const crypto = require('crypto')

// const { expect } = require('chai')
const { $sleep } = require('@holochain/n3h-common')

const {
  defaultConfig,
  // range,
  RRDht,
  actions
  // events
} = require('../lib/index')

const WORK_TARGET = Buffer.from('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 'hex').toString('base64')

const AGENTS = [
  [ 'bbRPMupkZ8r+Gq8PzlJaRbprHnj9uzZpioQOvcydC+4=', 'y30tJRVUkaPRhQ/eKFalZwQUSz30jlBjcTa1o+tJN6c=' ],
  [ 'PwvIxlz0fpgU5R0lX+JXX0o75b7uKQa9/3/9cneSqe8=', '27DxiOAgP6ipBRzzwmj1GTLVXiIuMCTcYpsGmISyN2U=' ],
  [ 'rT6X9yJ290DH1hl8UXxgao934b24K57FabSsKUiXHrs=', 'PXf8sTLupLIGQHIMEznw085tnk8rwVMBH3f0P1lf3P4=' ],
  [ 'HMM063jBlWEJTWhqH1yRbeOb1NcPIiCIRnq/jg0dRdY=', 'FU09N3LonRb3H3uPuybdxDB8Jm0CDC74YZT3OIWguxU=' ],
  [ 'LVO1fk2GtytLNLkmB4MH1jz27rEBXdQBcAs0MXU4ScM=', 'NfJWA6JhnWWb83Zp4jQlZWbY8WPlKJxcgdxrXSXOKGQ=' ],
  [ '8gOcgVAoXACN1jM2I0ZkPnKnhicnGa/UxygmIFrLAoQ=', 'OT9Vwqb+92Ppo2KQu0zNUZ/6Y7QPmRzyXQVXGAIsvj8=' ],
  [ 'l7RnxLcuAEBfAh9hDFGGhgtB0mA2JREdYABtLv03tPw=', 'VxtL7dIEOoQY/TQLeYcQYIYM/dO1UkneqwLILuByllk=' ],
  [ '+i2DHUpzJ7/k/22+OqVxXC+QyofOiQ4IjHkpnsw4iB8=', '/bBAadSyPW8YffV7qt2JLIBoUTAHAfHLxiVJ2G2DgqA=' ],
  [ 'zN4Vyv/KkLV0TT+yRbb1L0dgqY1cXE43e56wPOOgIlM=', 'tYIsjys9H1ux2MWlP9CQm+k0EckV10LdgkuZBKZVinc=' ],
  [ 'RWAL3Zn6OfSjPgSSsEDhjvyYzMIUHrsbtADqXGc9jC4=', 'dBiUZ3SgxsHh0yoFtC3IpN7bCYh+p/2R3F7iXYKcEzo=' ]
]

const DATA = [
  '37323f5f-77cb-4fbe-af39-3404fdd7796d',
  'bff3cd44-56fa-4380-a776-763158801eaf',
  '7182ef95-d823-450f-99d6-f0dfc4b4de18',
  '7ddd6724-b72f-461a-af35-58876d50fb93',
  '7fdd4d49-21af-4a03-8548-27a26ff7f0df',
  '2d9118b2-39fe-4ec5-9ae6-e80f4d7f2a27',
  '0e2ae219-d8d2-4246-9bbc-708ad68f837d',
  '547588c5-216f-4b8c-99e8-72953baf8686',
  'a2dce4ca-0706-4680-8343-856468386644'
]

describe('RRDht Integration Suite', () => {
  let preConf = null

  const nodes = new Map()
  const data = new Map()

  before(async () => {
    preConf = await (defaultConfig.generateConfigBuilder()
      .attach({
        agentLocWorkMemLimit: 8192,
        agentLocWorkOpsLimit: 1,
        agentLocWorkTarget: WORK_TARGET
      })
      .finalize())

    for (let d of DATA) {
      d = Buffer.from(d, 'utf8').toString('base64')
      const hash = await preConf.hashFn(d)
      data.set(hash, d)
    }
  })

  beforeEach(async () => {
    for (let i = 0; i < 10; ++i) {
      const agentHash = AGENTS[i][0]
      const agentNonce = AGENTS[i][1]

      const node = await new RRDht({
        agentLocWorkMemLimit: 8192,
        agentLocWorkOpsLimit: 1,
        agentLocWorkTarget: WORK_TARGET,
        agentHash,
        agentNonce,
        agentPeerInfo: {
          testId: i
        }
      })
      node.on('all', async evt => {
        switch (evt.type) {
          case 'unreliableGossipBroadcast':
            for (let peer of evt.peerList) {
              if (nodes.has(peer.hash)) {
                const ref = nodes.get(peer.hash)
                ref.node.act(actions.remoteGossipBundle(evt.bundle))
              }
            }
            break
          case 'dataHoldRequest':
            // for this test, we don't do any validation, just pass it back
            node.act(actions.dataHoldRequest(evt.dataHash))
            break
          case 'dataFetch':
            const d = data.get(evt.dataHash)
            node.act(actions.dataFetchResponse(
              evt.msgId, d))
            break
          default:
            console.error('unexpected event', evt)
            break
        }
      })
      nodes.set(agentHash, {
        agentHash,
        agentNonce,
        node
      })
    }

    for (let [hashA, nA] of nodes) {
      for (let [hashB, nB] of nodes) {
        if (hashA === hashB) {
          continue
        }
        nA.node.act(actions.peerHoldRequest({
          peerHash: hashB,
          peerNonce: nB.agentNonce,
          radii: await nB.node.getRadii()
        }))
      }
    }

    const n = nodes.get(AGENTS[0][0])
    for (let hash of data.keys()) {
      console.log('wouldStore data', hash, await n.node.wouldStoreData(hash))
      n.node.act(actions.dataPublish(hash, data.get(hash)))
    }
  })

  afterEach(async () => {
    for (let n of nodes.values()) {
      await n.node.destroy()
    }
    nodes.clear()
  })

  it('integration test', async () => {
    await $sleep(200)

    /*
    const results = []
    for (let n of nodes.values()) {
      for (let hash of data.keys()) {
        results.push(n.node.fetch(hash))
      }
    }
    console.log(JSON.stringify(await Promise.all(results), null, 2))
    */

    await $sleep(300)
  }).timeout(20000)
})
