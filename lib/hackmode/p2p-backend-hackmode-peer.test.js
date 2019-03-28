const { $sleep, unhandledRejection } = require('../n3h-common')
unhandledRejection.strict()
const msgpack = require('msgpack-lite')

const tweetlog = require('../tweetlog')
// tweetlog.set('t')
const log = tweetlog('@@-unit-test-@@')
// tweetlog.listen(tweetlog.console)

const { expect } = require('chai')

const { P2p } = require('../n3h-mod-spec')
const { P2pBackendHackmodePeer } = require('./p2p-backend-hackmode-peer')

describe('hackmode module p2p peer backend Suite', () => {
  let allNodes = []

  const dht = JSON.stringify({})
  const connection = JSON.stringify({
    passphrase: 'hello',
    rsaBits: 1024,
    bind: ['wss://127.0.0.1:0/integration-test']
  })

  const cleanup = async () => {
    await Promise.all(allNodes.map(n => n.destroy()))
    allNodes = []
  }

  const regNode = (node) => {
    allNodes.push(node)
    node.on('event', e => {
      switch (e.type) {
        case 'handleRequest':
          const data = msgpack.decode(Buffer.from(e.data, 'base64'))
          switch (data.type) {
            case 'echo':
              node.respondReliable(
                e.msgId, Buffer.from('echo: ' + data.data).toString('base64'))
              break
            default:
              throw new Error('unexpected request type: ' + data.type)
          }
          break
        case 'peerConnect':
          log.t('peer connected', e.peerAddress)
          break
        default:
          throw new Error('unexpected event type: ' + e.type)
      }
    })
  }

  const newBasic = async () => {
    const node = await new P2p(P2pBackendHackmodePeer, {
      dht: JSON.parse(dht),
      connection: JSON.parse(connection),
      wssAdvertise: 'auto'
    })
    regNode(node)
    return node
  }

  const req = async (node, toId, data) => {
    const res = await node.requestReliable(
      [toId], msgpack.encode({
        type: 'echo',
        data
      }).toString('base64'))
    return Buffer.from(res, 'base64').toString()
  }

  beforeEach(async () => {
    allNodes = []
  })

  afterEach(async () => {
    return cleanup()
  })

  it('up-down', async () => {
    try {
      await Promise.all([
        newBasic(), newBasic(), newBasic()
      ])

      const t0 = allNodes[0].getAdvertise()
      await Promise.all([
        allNodes[1].transportConnect(t0),
        allNodes[2].transportConnect(t0)
      ])

      const n1 = allNodes[1]
      const id1 = n1.getId()
      const n2 = allNodes[2]
      const id2 = n2.getId()

      expect(await req(n1, id2, 't')).equals('echo: t')

      await n1.close(id2)

      expect(await req(n1, id2, 't')).equals('echo: t')

      await n1.close(id2)

      expect(await req(n2, id1, 't')).equals('echo: t')
    } finally {
      await cleanup()
    }
  })

  it('integration', async () => {
    try {
      const nodeBase = await newBasic()

      const nodeFull = await newBasic()

      const baseConnectUri = nodeBase.getAdvertise()
      // console.log('BASE CONNECT URI', baseConnectUri)

      await nodeFull.transportConnect(baseConnectUri)

      const nodeNat = await new P2p(P2pBackendHackmodePeer, {
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
      res = await req(nodeFull, nodeBase.getId(), 'hello')
      expect(res).equals('echo: hello')

      // send from nat to full
      res = await req(nodeNat, nodeFull.getId(), 'hello2')
      expect(res).equals('echo: hello2')

      // send from full to nat
      res = await req(nodeFull, nodeNat.getId(), 'hello3')
      expect(res).equals('echo: hello3')

      await $sleep(1000)
    } finally {
      await cleanup()
    }
  }).timeout(10000)

  it('node dropping should not fail other nodes', async () => {
    try {
      const nodeBase = await newBasic()

      const nodeFull = await newBasic()

      const baseConnectUri = nodeBase.getAdvertise()
      // console.log('BASE CONNECT URI', baseConnectUri)

      await nodeFull.transportConnect(baseConnectUri)

      let res = null

      // send from full to base
      res = await req(nodeFull, nodeBase.getId(), 'hello')
      expect(res).equals('echo: hello')

      nodeFull.destroy()

      await $sleep(1000)
    } finally {
      await cleanup()
    }
  }).timeout(10000)
})
