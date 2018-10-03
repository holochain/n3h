#!/usr/bin/env node

const { Node } = require('../lib/index')

function _sleep (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

async function _main () {
  const node1 = new Node()
  const node2 = new Node()
  const node3 = new Node()

  const handleTerm = async () => {
    try {
      await node1.close()
    } catch (e) { /* pass */ }
    try {
      await node2.close()
    } catch (e) { /* pass */ }
    try {
      await node3.close()
    } catch (e) { /* pass */ }
    process.exit(0)
  }
  process.on('SIGINT', handleTerm)

  console.log('-- node1 --')
  let node1addr = ''
  await node1.init('ipc://node1.ipc.sock', '/ip4/0.0.0.0/tcp/0')
  console.log('-- node1 addrs --')
  for (let addr of node1.getAddrs()) {
    node1addr = addr
    console.log(addr)
  }
  console.log('-- node1 addrs --')

  console.log('-- node2 --')
  await node2.init('ipc://node2.ipc.sock', '/ip4/0.0.0.0/tcp/0')
  console.log('attept connect node2 to node1 (' + node1addr + ')')
  await node2.connect(node1addr)

  console.log('-- node3 --')
  await node3.init('ipc://node3.ipc.sock', '/ip4/0.0.0.0/tcp/0')
  console.log('attept connect node3 to node1 (' + node1addr + ')')
  await node3.connect(node1addr)

  await _sleep(10000)
  handleTerm()
}

_main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
