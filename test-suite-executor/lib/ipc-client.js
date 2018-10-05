
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
        console.log('test-exec got call', opt.data.toString())
        opt.resolve()
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
  async call (data) {
    return this._ipc.call(data)
  }
}

exports.TestIpcClient = TestIpcClient
