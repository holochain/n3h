#!/usr/bin/env node

const msgpack = require('msgpack-lite')

const { MoSocket } = require('mosocket')

const { Node, config } = require('../../lib/index')

async function _main () {
  if (process.argv.length < 3 || process.argv.length > 4) {
    throw new Error('expecting ipc / node name, and optional connect addr')
  }

  const c = config()
  c.ipc.socket = 'ipc://./' + process.argv[2] + '.ipc.sock'

  console.log('ipc socket: ' + c.ipc.socket)

  const node = new Node(c)

  const protoChat = node.installProtocol({
    name: 'c3hat',
    version: '0.0.1',
    hooks: {
      /**
       */
      m: {
        pattern: MoSocket.PATTERN_NOTIFY_RELIABLE,
        initiator: {
          onNotifyReliable: (message) => {
            return msgpack.encode({
              from: Node._friend(node._config.nodeId.id),
              msg: message
            })
          }
        },
        responder: {
          onNotifyReliable: (msg) => {
            msg = msgpack.decode(msg.data)
            node.ipcSendMessage(msgpack.encode({
              type: 'message',
              data: msg
            }))
          }
        }
      }
    }
  })

  node.on('connection', remoteId => {
    console.log('connected to', Node._friend(remoteId))
  })

  node.on('connectionClosed', remoteId => {
    console.log('lost connection to', Node._friend(remoteId))
  })

  node.on('ipcMessage', opt => {
    try {
      const msg = msgpack.decode(opt.data)
      switch (msg.type) {
        case 'getName':
          opt.resolve(msgpack.encode(Node._friend(node._config.nodeId.id)))
          break
        case 'message':
          const proxies = []
          for (let n of node._allNodes.values()) {
            if (n && n.proxy) {
              proxies.push(n.proxy)
            }
          }
          if (!proxies.length) {
            opt.resolve(Buffer.alloc(0))
            break
          }
          protoChat.m(proxies, msg.data)
          opt.resolve(Buffer.alloc(0))
          break
        default:
          opt.reject(new Error('unhandled message: ' + msg.type))
          break
      }
    } catch (e) {
      opt.reject(e)
    }
  })

  await node.init()
  await node.bind()

  if (process.argv.length > 3) {
    await node.connect(process.argv[3])
  }

  for (let e of node.getListeningAddrs()) {
    console.log(e)
  }

  _log('start')
  const handleTerm = () => {
    _log('end')
    node.close()
    process.exit(0)
  }

  process.on('SIGINT', handleTerm)
  process.on('SIGTERM', handleTerm)
  process.on('exit', handleTerm)
  process.on('uncaughtException', e => {
    console.error(e.stack || e.toString())
    handleTerm()
  })
}

function _log (...args) {
  // args.unshift((new Date()).toISOString())
  // fs.appendFileSync('_clog.txt', JSON.stringify(args) + '\n')
}

_main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
