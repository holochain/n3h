#!/usr/bin/env node

const { Node, config } = require('../lib/index')

async function _newNode () {
  const c = config()
  c.ipc.socket = 'ipc://./' + Node._friend(c.nodeId.id) + '.ipc.socket'
  console.log(Node._friend(c.nodeId.id))
  const node = new Node(c)
  await node.init()
  await node.bind()
  /*
  console.log('-- < node endpoints --')
  for (let e of node.getListeningAddrs()) {
    console.log(e)
  }
  console.log('-- node endpoints > --')
  */
  return node
}

function _sleep (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

async function _main () {
  console.log('-- node1 --')
  const node1 = await _newNode('n1')
  const node1addr = node1.getListeningAddrs()[0]

  console.log('-- node2 --')
  const node2 = await _newNode('n2')

  console.log('connecting node2 to node1:', node1addr)
  await node2.connect(node1addr)

  console.log('-- node3 --')
  const node3 = await _newNode('n3')

  console.log('connecting node3 to node1:', node1addr)
  await node3.connect(node1addr)

  await _sleep(1000)

  node1.close()
  node2.close()
  node3.close()
}

_main().then(() => {}, (err) => {
  console.log(err)
  process.exit(1)
})
