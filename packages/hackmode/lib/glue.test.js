const { $sleep } = require('@holochain/n3h-common')

const { Node } = require('./glue')

const NODE_COUNT = 2

describe('hackmode module glue Suite', () => {
  it('integration', async () => {
    const nodes = []
    let node0addr = null

    for (let i = 0; i < NODE_COUNT; ++i) {
      const node = await new Node({
        dht: {},
        connection: {
          passphrase: 'hello',
          rsaBits: 1024,
          bind: ['wss://127.0.0.1:0/integration-test']
        }
      })

      if (i === 0) {
        const b = node.getBindings()
        node0addr = b.next().value
      } else {
        await node.connect(node0addr)
      }

      nodes.push(node)
    }

    await $sleep(1000)

    await Promise.all(nodes.map(n => n.destroy()))
  }).timeout(10000)
})
