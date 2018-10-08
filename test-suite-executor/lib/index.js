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
    console.log('@@', JSON.stringify(defConfig, null, 2))

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.call(Buffer.from(JSON.stringify({
        method: 'setConfig',
        config: defConfig
      }))))
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

    console.log('got all calls')

    this.emit('done')
  }
}

exports.TestSuiteExecutor = TestSuiteExecutor
