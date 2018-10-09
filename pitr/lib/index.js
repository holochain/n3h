const path = require('path')
const os = require('os')
const { URL } = require('url')

const state = require('./state')
const modules = require('./modules')
const { AsyncClass, mkdirp } = require('n3h-common')
const { PitrIpcServer } = require('./ipc-server')

// modules self load
require('./modules/persistence')
require('./modules/messenger')

/**
 */
class Pitr extends AsyncClass {
  /**
   */
  constructor () {
    super()

    return AsyncClass.$construct(this, async (self) => {
      // make sure all our modules are loaded
      await modules.ready()

      state.workDir = 'N3H_WORK_DIR' in process.env
        ? process.env.N3H_WORK_DIR
        : path.resolve(path.join(
          os.homedir(), '.nh3'))

      await mkdirp(state.workDir)
      process.chdir(state.workDir)

      state.ipcUri = 'N3H_IPC_SOCKET' in process.env
        ? process.env.N3H_IPC_SOCKET
        : 'ipc://' + path.resolve(path.join(
          os.homedir(), '.n3h', 'n3h-ipc.socket'))

      const tmpUri = new URL(state.ipcUri)
      if (tmpUri.protocol === 'ipc:') {
        await mkdirp(path.dirname(tmpUri.pathname))
      }

      self.$pushDestructor(async () => {
        await Promise.all([
          self._ipc.destroy()
        ])
        self._ipc = null
        await modules.destroy()
        if (typeof self._resolve === 'function') {
          self._resolve()
        }
        self._resolve = null
        self._reject = null
      })

      await self._startupServices()

      return self
    })
  }

  run () {
    return new Promise((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject

      console.log('up and running')
    })
  }

  // -- private -- //

  /**
   */
  async _startupServices () {
    this._ipc = await new PitrIpcServer(state.ipcUri)
    console.log('#IPC-READY#')
    this._ipc.on('configReady', async () => {
      await modules.createModules()
      await modules.injectModule('ipc', this._ipc)
      await modules.initModules()
      console.log('@@ modules initialized!!')
    })
  }
}

exports.Pitr = Pitr
