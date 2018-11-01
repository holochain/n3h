const path = require('path')

const tmp = require('tmp')

const { AsyncClass, mkdirp, $sleep } = require('n3h-common')

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

    const defConfig = JSON.parse((await Promise.all(wait))[0].config)
    console.log('@@config@@', JSON.stringify(defConfig, null, 2))

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

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.requestState())
    }

    console.log('@@', await Promise.all(wait))

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.requestBindings())
    }

    wait = await Promise.all(wait)
    console.log('@@', wait)

    const hubAddr = wait[0].bindings[0]

    console.log('@@ using as hub:', hubAddr)

    wait = []
    for (let i = 1; i < this._nodes.length; ++i) {
      const node = this._nodes[i]
      wait.push(node.ipcClient.connect(hubAddr))
    }

    console.log('@@', await Promise.all(wait))

    wait = []
    for (let node of this._nodes) {
      wait.push(new Promise(async (resolve, reject) => {
        try {
          const id = await node.ipcClient.getId()
          node.$id = id.id
          resolve(id.id)
        } catch (e) {
          reject(e)
        }
      }))
    }

    console.log('@@', await Promise.all(wait))

    wait = []
    for (let fromNode of this._nodes) {
      for (let toNode of this._nodes) {
        if (fromNode === toNode) {
          continue
        }
        console.log('message from', fromNode.$id, 'to', toNode.$id)
        wait.push((async () => {
          const magic = Math.random().toString(36).substr(2, 6)
          const result = await fromNode.ipcClient.send({
            toAddress: toNode.$id,
            id: magic,
            data: magic
          })
          if (result !== 'echo: ' + magic) {
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
