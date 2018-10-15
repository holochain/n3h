const { AsyncClass, Moduleit } = require('n3h-common')
const { IpcServer: RawIpcServer } = require('ipc')

/**
 */
class IpcServer extends AsyncClass {
  /**
   */
  async init (ipcSocketUri, modules) {
    await super.init()

    this._modules = await new Moduleit()

    this._moduleTmp = this._modules.loadModuleGroup(modules)
    this._defaultConfig = JSON.stringify(
      this._moduleTmp.defaultConfig, null, 2)

    this._state = 'need_config'

    this._ipc = new RawIpcServer()

    this._ipc.on('clientAdd', id => {
      console.log('clientAdd', id)
    })

    this._ipc.on('clientRemove', id => {
      console.log('clientRemove', id)
    })

    this._ipc.on('call', async opt => {
      await this._handleCall(opt)
    })

    this.$pushDestructor(async () => {
      await this._ipc.destroy()
      this._ipc = null
    })

    await this._ipc.bind(ipcSocketUri)
    console.log('bound to', ipcSocketUri)
  }

  /**
   */
  async start () {
    /* pass - we initialize in init */
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
          return opt.resolve(this._state)
        case 'getDefaultConfig':
          return opt.resolve(this._defaultConfig)
        case 'setConfig':
          // startup can take a while
          opt.resetTimeout(10000)

          this._state = 'pending'

          await this._moduleTmp.createGroup(call.config)
          this._moduleTmp = null

          this._state = 'ready'
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
