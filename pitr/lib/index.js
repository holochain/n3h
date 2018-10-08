const path = require('path')
const os = require('os')
const { URL } = require('url')

const state = require('./state')
const modules = require('./modules')
const { AsyncClass, mkdirp } = require('n3h-common')
const { PitrIpcServer } = require('./ipc-server')

// modules self load
require('./modules/persistence')

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

      self._modules = await modules.createModules()

      self.$pushDestructor(async () => {
        await Promise.all([
          self._ipc.destroy()
        ])
        self._ipc = null
        await self._modules.destroy()
        self._modules = null
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
  }
}

Pitr.defaultInitialConfig = {
  '#hcIpc': 'config for how holochain will communicate with us',
  hcIpc: {
    '#ipcUri': 'the zmq socket uri to listen on ($N3H_WORK is available)',
    ipcUri: 'ipc://$N3H_WORK/n3h-ipc.socket'
  },
  '#persistence': 'config for how p2p info will be cached / persisted',
  persistence: {
    '#backend': 'settings for the backend persistence',
    backend: {
      '#type': 'backend type (only have sqlite3 for now)',
      type: 'sqlite3',
      '#config': 'backend specific configuration',
      config: {
        '#file': 'the sqlite3 file to use ($N3H_WORK is available)',
        file: '$N3H_WORK/n3h-persistence.sqlite3'
      }
    }
  }
}

exports.Pitr = Pitr
