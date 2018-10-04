const fs = require('fs')
const path = require('path')
const os = require('os')

const { HashCache } = require('hashcache')

/**
 */
class Pitr {
  /**
   */
  constructor () {
    this._workDir = 'N3H_WORK' in process.env
      ? process.env.N3H_WORK
      : path.resolve(path.join(os.homedir(), '.n3h'))
    this._configFile = path.join(this._workDir, 'n3h-config.json')

    const parts = this._workDir.split(/[/\\]/g)
    let cur = ''
    while (parts.length) {
      cur = path.join(cur, parts.shift())
      try {
        fs.mkdirSync(cur)
      } catch (e) { /* pass */ }
    }

    let config = null
    try {
      config = fs.readFileSync(this._configFile)
    } catch (e) {
      config = JSON.stringify(Pitr.defaultInitialConfig, null, 2)
      fs.writeFileSync(this._configFile, config + '\n')
    }

    this._config = JSON.parse(config)
    this._config.hcIpc.ipcUri = this._fixWorkDir(this._config.hcIpc.ipcUri)
    this._config.persistence.backend.config.file =
      this._fixWorkDir(this._config.persistence.backend.config.file)
  }

  /**
   */
  async run () {
    this._persist = await HashCache.connect(this._config.persistence)
  }

  // -- private -- //

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
