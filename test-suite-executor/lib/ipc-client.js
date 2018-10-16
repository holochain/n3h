
const { AsyncClass } = require('n3h-common')
const { IpcClient } = require('ipc')

/**
 */
class TestIpcClient extends AsyncClass {
  /**
   */
  constructor (addr) {
    super()

    return AsyncClass.$construct(this, async (self) => {
      self._ipc = new IpcClient()
      self._ipc.on('call', async (opt) => {
        console.log('test-exec got call', opt.data.toString(), 'echoing')
        const data = JSON.parse(opt.data.toString()).data
        opt.resolve('echo: ' + data)
      })
      console.log('connecting to', addr)
      await self._ipc.connect(addr)

      self.$pushDestructor(async () => {
        await self._ipc.destroy()
        self._ipc = null
      })

      return self
    })
  }

  /**
   */
  async call (data, timeout) {
    return this._ipc.call(data, timeout)
  }
}

exports.TestIpcClient = TestIpcClient
