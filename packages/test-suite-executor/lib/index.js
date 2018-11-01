const path = require('path')

const tmp = require('tmp')

const { AsyncClass, mkdirp } = require('n3h-common')

const { TestIpcClient } = require('./ipc-client')

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
        node.ipcClient = await new TestIpcClient(node.ipcUri)
      })())
    }

    await Promise.all(wait)

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.call(Buffer.from(JSON.stringify({
        method: 'getState'
      }))))
    }

    console.log('@@', await Promise.all(wait))

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.call(Buffer.from(JSON.stringify({
        method: 'getDefaultConfig'
      }))))
    }

    const defConfig = JSON.parse((await Promise.all(wait))[0])
    console.log('@@config@@', JSON.stringify(defConfig, null, 2))

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.call(Buffer.from(JSON.stringify({
        method: 'setConfig',
        config: defConfig
      })), 10000))
    }

    await Promise.all(wait)
    console.log('@@ setComplete')

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.call(Buffer.from(JSON.stringify({
        method: 'getState'
      }))))
    }

    console.log('@@', await Promise.all(wait))

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.call(Buffer.from(JSON.stringify({
        method: 'getBindings'
      }))))
    }

    wait = await Promise.all(wait)
    console.log('@@', wait)

    const hubAddr = wait[0][0]

    console.log('@@ using as hub:', hubAddr)

    wait = []
    for (let i = 1; i < this._nodes.length; ++i) {
      const node = this._nodes[i]
      wait.push(node.ipcClient.call(Buffer.from(JSON.stringify({
        method: 'connect',
        address: hubAddr
      })), 10000))
    }

    console.log('@@', await Promise.all(wait))

    wait = []
    for (let node of this._nodes) {
      wait.push(new Promise(async (resolve, reject) => {
        try {
          const id = await node.ipcClient.call(Buffer.from(JSON.stringify({
            method: 'getId'
          })))
          node.$id = id
          resolve(id)
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
          const result = await fromNode.ipcClient.call(Buffer.from(JSON.stringify({
            method: 'send',
            toAddress: toNode.$id,
            data: magic
          })))
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
