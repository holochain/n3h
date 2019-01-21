const { $sleep } = require('@holochain/n3h-common')

const { Node } = require('./glue')

describe('hackmode module glue Suite', () => {
  it('integration', async () => {
    const allNodes = []

    const regNode = (node) => {
      allNodes.push(node)
      node.on('message', m => {
        switch (m.type) {
          case 'echo':
            m.respond(Buffer.concat([
              Buffer.from('echo: '),
              m.data
            ]))
            break
          default:
            throw new Error('unexpected msg type ' + m.type)
        }
      })
    }

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
    regNode(nodeBase)

    const nodeFull = await new Node({
      dht: JSON.parse(dht),
      connection: JSON.parse(connection),
      wssAdvertise: 'auto'
    })
    regNode(nodeFull)

    const baseConnectUri = nodeBase.getAdvertise()

    await nodeFull.connect(baseConnectUri)

    const nodeNat = await new Node({
      dht: JSON.parse(dht),
      connection: {
        passphrase: 'hello',
        rsaBits: 1024
      },
      wssRelayPeers: [baseConnectUri]
    })
    regNode(nodeNat)

    // send
    const res = await nodeFull.send(nodeBase.getId(), 'echo', Buffer.from('hello'))
    console.log('@@ got @@', res.toString())

    await $sleep(1000)

    await Promise.all(allNodes.map(n => n.destroy()))
  }).timeout(10000)
})
