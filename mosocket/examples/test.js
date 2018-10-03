#!/usr/bin/env node
'use strict'

const msgpack = require('msgpack-lite')

const { MoSocket, config } = require('../lib/index')

class MyNode extends MoSocket {
  constructor (config) {
    super(config)

    this.on('bind', (addr) => {
      console.log('node listening at', addr)
    })

    this.myproto = this.installProtocol({
      name: 'MyProto',
      version: '0.0.1',
      hooks: {
        paperAirplane: {
          pattern: MoSocket.PATTERN_NOTIFY_RELIABLE,
          initiator: {
            onNotifyReliable: (style, color) => {
              return msgpack.encode({
                style,
                color
              })
            }
          },
          responder: {
            onNotifyReliable: (msg) => {
              msg = msgpack.decode(msg.data)
              console.log('[paperAirplane] ' + JSON.stringify(msg))
            }
          }
        },
        makeSandwich: {
          pattern: MoSocket.PATTERN_FIRST,
          initiator: {
            onPreauthReq: (ctx, cheese, filler) => {
              ctx._cheese = cheese
              ctx._filler = filler
              return msgpack.encode(!!cheese)
            },
            onRequest: (ctx) => {
              return msgpack.encode(ctx._filler.toString())
            },
            onResponse: (ctx, msg) => {
              msg = msgpack.decode(msg.data)
              return {
                cheese: ctx._cheese,
                filler: ctx._filler,
                result: msg
              }
            }
          },
          responder: {
            onPreauthReq: (ctx, msg) => {
              const cheese = msgpack.decode(msg.data)
              ctx._cheese = cheese
              if (cheese) {
                throw new Error('we have no cheese')
              }
            },
            onRequest: (ctx, msg) => {
              const filler = msgpack.decode(msg.data)
              if (filler === 'salami') {
                throw new Error('we have no salami')
              }
              return msgpack.encode(
                'sandwich(cheese:' + ctx._cheese + ',filler:' + filler + ')')
            }
          }
        }
      }
    })
  }
}

async function _main () {
  const node1 = new MyNode(config())
  node1.on('bind', (addr) => {
    console.log('node listening at', addr)
  })
  node1.on('connection', (proxy) => {
    console.log('got connection:', proxy.toString(), node1.getAddr(proxy))
    node1.myproto.paperAirplane([proxy], 'wide', 'green')
  })

  await node1.bind()

  const addr = node1.getListeningAddrs()[0]
  console.log('attempting to connect to', addr)

  const node2 = new MyNode(config())

  const remote = await node2.connect(addr)
  console.log('connected:', remote.toString(), node2.getAddr(remote))

  await node2.myproto.paperAirplane([remote], 'slim', 'yellow')
  let sandwich = await node2.myproto.makeSandwich([remote], false, 'avacado')
  console.log('makeSandwich:result1:', sandwich)

  let success = false
  try {
    sandwich = await node2.myproto.makeSandwich([remote], true, 'avacado')
  } catch (e) {
    console.log('makeSandwich:result2 success - server has no cheese')
    success = true
  }
  if (!success) {
    throw new Error('expected the server to have no cheese')
  }

  success = false
  try {
    sandwich = await node2.myproto.makeSandwich([remote], false, 'salami')
  } catch (e) {
    console.log('makeSandwich:result3 success - server has no salami')
    success = true
  }
  if (!success) {
    throw new Error('expected the server to have no salami')
  }

  node1.close()
  node2.close()
}

_main().then(() => {}, (err) => {
  console.error(err.stack || err.toString())
  process.exit(1)
})
