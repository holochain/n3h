const path = require('path')

const tmp = require('tmp')

const { AsyncClass, mkdirp, $sleep } = require('@holochain/n3h-common')

const { IpcWrapper } = require('./ipc-wrapper')

/**
 */
class TestSuiteExecutor extends AsyncClass {
  /**
   */
  constructor () {
    super()

    return AsyncClass.$construct(this, async (self) => {
      self._nodes = []
      self._dirs = []

      self.$pushDestructor(async () => {
        const wait = []
        for (let node of self._nodes) {
          wait.push(self.emit('killNode', node))
          wait.push(node.nodePromise)
        }
        await Promise.all(wait)
        self._nodes = null

        for (let dir of self._dirs) {
          dir()
        }
        self._dirs = null
      })

      return self
    })
  }

  /**
   */
  async run () {
    let wait = []
    for (let i = 0; i < 3; ++i) {
      const node = {}
      node.nodePromise = new Promise((resolve, reject) => {
        node.resolve = resolve
        node.reject = reject
      })

      node.name = 'node-' + i
      const t = tmp.dirSync({
        prefix: 'n3h-test-suite-' + node.name + '-',
        unsafeCleanup: true
      })

      node.dir = t.name
      this._dirs.push(t.removeCallback)

      await mkdirp(node.dir)

      node.ipcUri = 'ipc://' + path.join(node.dir, 'n3h-ipc.socket')

      wait.push(this.emit('spawnNode', node))

      this._nodes.push(node)
    }

    await Promise.all(wait)

    wait = []
    for (let node of this._nodes) {
      wait.push((async () => {
        node.ipcClient = await new IpcWrapper(node.ipcUri)
      })())
    }

    await Promise.all(wait)

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.requestState())
    }

    console.log('@@', await Promise.all(wait))

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.requestDefaultConfig())
    }

    const defConfig = (await Promise.all(wait))[0].config
    console.log('@@config@@', defConfig)

    for (let node of this._nodes) {
      node.ipcClient.setConfig(defConfig)
    }

    for (;;) {
      await $sleep(100)

      wait = []
      for (let node of this._nodes) {
        wait.push(node.ipcClient.requestState())
      }

      wait = await Promise.all(wait)

      let done = true

      for (let item of wait) {
        if (item.state !== 'ready') {
          console.log('state is still ' + item.state + ' ... waiting...')
          done = false
          break
        }
      }

      if (done) {
        break
      }
    }
    await Promise.all(wait)
    console.log('@@ setComplete')

    let hubId = null
    let hubAddr = null

    wait = []
    for (let node of this._nodes) {
      wait.push((async () => {
        const state = await node.ipcClient.requestState()
        node.$id = state.id
        if (!hubAddr) {
          hubId = state.id
          hubAddr = state.bindings[0]
        }
      })())
    }

    await Promise.all(wait)

    for (let node of this._nodes) {
      if (node.$id === hubId) {
        console.log('hub address:', hubAddr)
      } else {
        console.log('connect', node.$id, 'to hub')
        node.ipcClient.connect(hubAddr)
      }
    }

    let peerConnectedCount = 0
    for (;;) {
      await $sleep(100)
      let done = false
      for (let node of this._nodes) {
        const uh = node.ipcClient.getUnhandled()
        if (uh && uh.method === 'peerConnected') {
          ++peerConnectedCount
          console.log('@@ new peer count', peerConnectedCount, uh.id)
          if (peerConnectedCount >= 4) {
            done = true
            break
          }
        }
      }
      if (done) {
        break
      }
    }

    wait = []
    for (let fromNode of this._nodes) {
      for (let toNode of this._nodes) {
        if (fromNode === toNode) {
          continue
        }
        console.log('message from', fromNode.$id, 'to', toNode.$id)
        wait.push((async () => {
          const message = 'message # ' + (wait.length + 1)
          const result = await fromNode.ipcClient.send({
            toAddress: toNode.$id,
            data: message
          })
          if (result.data !== 'echo: ' + message) {
            throw new Error('unexpected result: ' + JSON.stringify(result))
          }
          return result
        })())
      }
    }

    console.log('@@', await Promise.all(wait))

    console.log('got all calls')

    this.emit('done')
  }
}

exports.TestSuiteExecutor = TestSuiteExecutor
