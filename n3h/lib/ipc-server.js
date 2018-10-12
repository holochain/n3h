const { AsyncClass } = require('n3h-common')
const { IpcServer: RawIpcServer } = require('ipc')
const state = require('./state')

/**
 */
class IpcServer extends AsyncClass {
  /**
   */
  constructor (ipcSocketUri) {
    super()

    return AsyncClass.$construct(this, async (self) => {
      self._ipc = new RawIpcServer()

      self._ipc.on('clientAdd', id => {
        console.log('clientAdd', id)
      })

      self._ipc.on('clientRemove', id => {
        console.log('clientRemove', id)
      })

      self._ipc.on('call', async opt => {
        await self._handleCall(opt)
      })

      self.$pushDestructor(async () => {
        await self._ipc.destroy()
        self._ipc = null
      })

      await self._ipc.bind(ipcSocketUri)
      console.log('bound to', ipcSocketUri)

      return self
    })
  }

  /**
   */
  async getDefaultConfig () {
    // not needed for injected module
  }

  /**
   */
  async createInstance (/* config */) {
    return this
  }

  async initInstance () {
  }

  // -- private -- //

  async _handleCall (opt) {
    try {
      let call = null
      try {
        call = JSON.parse(opt.data.toString())
      } catch (e) {
        throw new Error('expected json... ' + (e.stack || e.toString()))
      }
      if (typeof call !== 'object' || typeof call.method !== 'string') {
        throw new Error('expected object.method to be a string')
      }

      switch (call.method) {
        case 'getState':
          return opt.resolve(state.state)
        case 'getDefaultConfig':
          return opt.resolve(state.defaultConfig)
        case 'setConfig':
          state.config = call.config
          state.state = 'pending'
          await this.emit('configReady')
          return opt.resolve()
        default:
          throw new Error('unhandled method: ' + call.method)
      }
    } catch (e) {
      opt.reject(e)
    }
  }
}

exports.IpcServer = IpcServer
