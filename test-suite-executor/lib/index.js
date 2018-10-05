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
      node.nodePromise = new Promise(async (resolve, reject) => {
        try {
          node.resolve = resolve
          node.reject = reject
          node.nodeName = 'node-' + i
          const t = tmp.dirSync({
            prefix: 'n3h-test-suite-' + node.nodeName + '-',
            unsafeCleanup: true
          })
          node.nodeDir = t.name
          this._dirs.push(t.removeCallback)

          await mkdirp(node.nodeDir)

          wait.push(this.emit('spawnNode', node))
        } catch (e) {
          reject(e)
        }
      })
      this._nodes.push(node)
    }

    await Promise.all(wait)

    wait = []
    for (let node of this._nodes) {
      wait.push((async () => {
        node.ipcClient = await new TestIpcClient('ipc://' + path.join(
          node.nodeDir, 'n3h-ipc.socket'))
      })())
    }

    await Promise.all(wait)

    wait = []
    for (let node of this._nodes) {
      wait.push(node.ipcClient.call(Buffer.from('funky')))
    }

    await Promise.all(wait)

    console.log('got all calls')
  }
}

exports.TestSuiteExecutor = TestSuiteExecutor
