#!/usr/bin/env node

const { Node, config } = require('../../lib/index')

async function _main () {
  if (process.argv.length !== 3) {
    throw new Error('expecting ipc / node name')
  }

  const c = config()
  c.ipc.socket = 'ipc://./' + process.argv[2] + '.ipc.sock'

  console.log('ipc socket: ' + c.ipc.socket)

  const node = new Node(c)
  await node.init()
  await node.bind()

  for (let e of node.getListeningAddrs()) {
    console.log(e)
  }

  const handleTerm = () => {
    node.close()
  }

  process.on('SIGINT', handleTerm)
  process.on('SIGTERM', handleTerm)
  process.on('exit', handleTerm)
  process.on('uncaughtException', (e) => {
    console.error(e.stack || e.toString())
    handleTerm()
  })
}

_main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
