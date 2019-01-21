const { $sleep } = require('@holochain/n3h-common')

const { Node } = require('./glue')

const NODE_COUNT = 2

describe('hackmode module glue Suite', () => {
  it('integration', async () => {
    const allNodes = []

    const dht = JSON.stringify({})
    const connection = JSON.stringify({
      passphrase: 'hello',
      rsaBits: 1024,
      bind: ['wss://127.0.0.1:0/integration-test']
    })

    const nodeBase = await new Node({
      dht: JSON.parse(dht),
      connection: JSON.parse(connection),
      wssAdvertise: 'auto'
    })
    allNodes.push(nodeBase)

    const nodeFull = await new Node({
      dht: JSON.parse(dht),
      connection: JSON.parse(connection),
      wssAdvertise: 'auto'
    })
    allNodes.push(nodeFull)

    const baseConnectUri = nodeBase.getAdvertise()

    await nodeFull.connect(baseConnectUri)

    const nodeNat = await new Node({
      dht: JSON.parse(dht),
      connection: {
        passphrase: 'hello',
        rsaBits: 1024
      },
      wssRelayPeer: baseConnectUri
    })
    allNodes.push(nodeNat)

    await $sleep(1000)

    await Promise.all(allNodes.map(n => n.destroy()))
  }).timeout(10000)
})
