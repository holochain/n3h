const fs = require('fs')
const path = require('path')
const os = require('os')

const { AsyncClass, mkdirp } = require('n3h-common')
const { HashCache } = require('hashcache')
const { IpcServer } = require('ipc')

/**
 */
class Pitr extends AsyncClass {
  /**
   */
  constructor () {
    super()

    return AsyncClass.$construct(this, async (self) => {
      self._workDir = 'N3H_WORK' in process.env
        ? process.env.N3H_WORK
        : path.resolve(path.join(os.homedir(), '.n3h'))
      self._configFile = path.join(self._workDir, 'n3h-config.json')

      await mkdirp(self._workDir)

      let config = null
      try {
        config = fs.readFileSync(self._configFile)
      } catch (e) {
        config = JSON.stringify(Pitr.defaultInitialConfig, null, 2)
        fs.writeFileSync(self._configFile, config + '\n')
      }

      self._config = JSON.parse(config)
      self._config.hcIpc.ipcUri = self._fixWorkDir(self._config.hcIpc.ipcUri)
      self._config.persistence.backend.config.file =
        self._fixWorkDir(self._config.persistence.backend.config.file)

      self.$pushDestructor(async () => {
        await Promise.all([
          self._ipc.destroy(),
          self._persist.destroy()
        ])
        self._ipc = null
        self._persist = null
      })

      await self._startupServices()

      return self
    })
  }

  run () {
    return new Promise((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
    })
  }

  // -- private -- //

  /**
   */
  async _startupServices () {
    this._persist = await new HashCache(this._config.persistence)

    this._ipc = new IpcServer()
    this._ipc.on('clientAdd', id => {
      console.log('client added', id)
    })
    this._ipc.on('clientRemove', id => {
      console.log('client removed', id)
    })
    this._ipc.on('call', async opt => {
      const call = opt.data.toString()
      console.log('n3h got call', call)
      if (call === 'funky') {
        await this._ipc.call(Buffer.from('test-from-n3h'))
      }
      opt.resolve()
    })
    await this._ipc.bind(this._config.hcIpc.ipcUri)
    console.log('bound to', this._config.hcIpc.ipcUri)
  }

  _fixWorkDir (str) {
    return str.replace(/\$N3H_WORK/g, this._workDir)
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
