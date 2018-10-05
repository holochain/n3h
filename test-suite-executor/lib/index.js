const EventEmitter = require('events')

const tmp = require('tmp')
tmp.setGracefulCleanup()

const { IpcClient } = require('ipc')

/**
 */
class TestSuiteExecutor extends EventEmitter {
  /**
   */
  constructor () {
    super()
    this.setMaxListeners(1)

    this._nodes = []
  }

  /**
   */
  async run () {
    console.log(typeof IpcClient)

    for (let i = 0; i < 3; ++i) {
      const node = {}
      node.nodePromise = new Promise((resolve, reject) => {
        node.resolve = resolve
        node.reject = reject
        node.nodeName = 'node-' + i
        node.nodeDir = tmp.dirSync({
          prefix: 'n3h-test-suite-' + node.nodeName + '-'
        }).name

        this.emit('spawnNode', node)
      })
      this._nodes.push(node)
    }

    const wait = []
    for (let node of this._nodes) {
      wait.push(node.nodePromise)
      this.emit('killNode', node)
    }

    await Promise.all(wait)
  }
}

exports.TestSuiteExecutor = TestSuiteExecutor
