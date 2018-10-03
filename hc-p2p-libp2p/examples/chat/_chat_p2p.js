#!/usr/bin/env node

const msgpack = require('msgpack-lite')

const { Node } = require('../../lib/index')

async function _main () {
  if (process.argv.length < 3 || process.argv.length > 4) {
    throw new Error('expecting ipc / node name, and optional connect addr')
  }

  const ipc = 'ipc://./' + process.argv[2] + '.ipc.sock'

  console.log('ipc socket: ' + ipc)

  const node = new Node()
  console.log('initialize node')
  await node.init(ipc, '/ip4/0.0.0.0/tcp/0')

  node.on('message', opt => {
    opt.resolve()
    node.ipcSendMessage(msgpack.encode({
      type: 'message',
      data: {
        from: opt.data.from.substr(0, 8),
        msg: opt.data.msg
      }
    }))
  })

  node.on('ipcMessage', async opt => {
    try {
      const msg = msgpack.decode(opt.data)
      switch (msg.type) {
        case 'getName':
          opt.resolve(msgpack.encode(node.getId().substr(0, 8)))
          break
        case 'message':
          opt.resolve(Buffer.alloc(0))
          // trying to store data in dht??
          const s = msg.data.match(/^\/store\s*([^=]+)=(.+)$/)
          if (s && s.length === 3) {
            const key = s[1].trim()
            const val = s[2].trim()
            console.log(`store '${key}'='${val}'`)
            await node.store(key, val)
            break
          }
          // trying to fetch data from dht??
          const f = msg.data.match(/^\/fetch\s*(.+)$/)
          if (f && f.length === 2) {
            const key = f[1].trim()
            console.log(`fetch '${key}'`)
            const res = node.fetch(key)
            console.log(`fetched '${key}' = '${res.toString()}'`)
            break
          }
          // otherwise, it's just a message
          for (let peer of node.listPeers()) {
            node.send(peer, msgpack.encode(msg.data)).then(() => {}, () => {})
          }
          break
        default:
          opt.reject(new Error('unhandled message: ' + msg.type))
          break
      }
    } catch (e) {
      opt.reject(e)
    }
  })

  if (process.argv.length > 3) {
    await node.connect(process.argv[3])
  }

  for (let e of node.getAddrs()) {
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

  setInterval(() => {}, 1000)
}

function _log (...args) {
  // args.unshift((new Date()).toISOString())
  // fs.appendFileSync('_clog.txt', JSON.stringify(args) + '\n')
}

_main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
