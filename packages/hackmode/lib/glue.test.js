const { $sleep, unhandledRejection } = require('@holochain/n3h-common')
unhandledRejection.strict()
const msgpack = require('msgpack-lite')

const { expect } = require('chai')

const { P2p } = require('@holochain/n3h-mod-spec')
const { P2pBackendGlue } = require('./glue')

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

    try {
      const dht = JSON.stringify({})
      const connection = JSON.stringify({
        passphrase: 'hello',
        rsaBits: 1024,
        bind: ['wss://127.0.0.1:0/integration-test']
      })

      const nodeBase = await new P2p(P2pBackendGlue, {
        dht: JSON.parse(dht),
        connection: JSON.parse(connection),
        wssAdvertise: 'auto'
      })
      regNode(nodeBase)

      const nodeFull = await new P2p(P2pBackendGlue, {
        dht: JSON.parse(dht),
        connection: JSON.parse(connection),
        wssAdvertise: 'auto'
      })
      regNode(nodeFull)

      const baseConnectUri = nodeBase.getAdvertise()
      console.log('BASE CONNECT URI', baseConnectUri)

      await nodeFull.transportConnect(baseConnectUri)

      const nodeNat = await new P2p(P2pBackendGlue, {
        dht: JSON.parse(dht),
        connection: {
          passphrase: 'hello',
          rsaBits: 1024
        },
        wssRelayPeers: [baseConnectUri]
      })
      regNode(nodeNat)

      let res = null

      // send from full to base
      res = await nodeFull.requestReliable(
        [nodeBase.getId()], msgpack.encode({
          type: 'echo',
          data: 'hello'
        }).toString('base64'))
      expect(res.toString()).equals('echo: hello')

      // send from nat to full
      res = await nodeNat.requestReliable(
        [nodeFull.getId()], msgpack.encode({
          type: 'echo',
          data: 'hello2'
        }).toString('base64'))
      expect(res.toString()).equals('echo: hello2')

      // send from full to nat
      res = await nodeFull.requestReliable(
        [nodeNat.getId()], msgpack.encode({
          type: 'echo',
          data: 'hello3'
        }).toString('base64'))
      expect(res.toString()).equals('echo: hello3')

      await $sleep(1000)
    } finally {
      await Promise.all(allNodes.map(n => n.destroy()))
    }
  }).timeout(10000)
})
