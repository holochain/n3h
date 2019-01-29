const path = require('path')
const os = require('os')
const { URL } = require('url')
const { AsyncClass, mkdirp, ModMod } = require('@holochain/n3h-common')

const { IpcServer } = require('@holochain/n3h-ipc')

const DEFAULT_MODULES = [
  require('@holochain/n3h-mod-nv-persist-sqlite3').NvPersistSqlite3,
  require('@holochain/n3h-mod-persist-cache-lru').PersistCacheLru,
  require('@holochain/n3h-mod-message-libp2p').MessageLibP2p
]

exports.N3hHackMode = require('@holochain/hackmode').N3hHackMode
exports.N3hMock = require('@holochain/n3h-mock').N3hMock

/**
 */
class N3hNode extends AsyncClass {
  /**
   */
  static async constructDefault (workDir, modules) {
    return new N3hNode(workDir, (modules || []).concat(DEFAULT_MODULES))
  }

  /**
   */
  async init (workDir, modules) {
    await super.init()

    this._workDir = workDir

    this._ipcUri = 'N3H_IPC_SOCKET' in process.env
      ? process.env.N3H_IPC_SOCKET
      : 'ipc://' + path.resolve(path.join(
        os.homedir(), '.n3h', 'n3h-ipc.socket'))

    const tmpUri = new URL(this._ipcUri)
    if (tmpUri.protocol === 'ipc:') {
      await mkdirp(path.dirname(tmpUri.pathname))
    }

    if (!Array.isArray(modules)) {
      throw new Error('modules must be an array')
    }
    const giveIpc = () => this._ipc
    modules.push(class {
      static getDefinition () {
        return {
          type: 'ipc',
          name: '_builtin_',
          defaultConfig: {}
        }
      }

      constructor () {
        return giveIpc()
      }
    })

    this._handlers = []

    this._sendHandlerIdWait = {}

    this.$pushDestructor(async () => {
      await Promise.all([
        this._ipc.destroy()
      ])
      this._ipc = null
      if (typeof this._resolve === 'function') {
        this._resolve()
      }
      this._resolve = null
      this._reject = null
      this._handlers = null
      this._sendHandlerIdWait = null
    })

    await this._startupServices(modules)
  }

  run () {
    return new Promise((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject

      console.log('up and running')
    })
  }

  // -- private -- //

  _getNextId () {
    this._lastId || (this._lastId = Math.random())
    this._lastId += 1 + Math.random()
    return this._lastId.toString(36)
  }

  /**
   */
  async _startupServices (modules) {
    this._modules = await new ModMod({
      nvPersist: ['get', 'set'],
      persistCache: ['getNsAsStringJson', 'get', 'set', 'prune'],
      message: ['getId', 'getBindings', 'connect', 'send'],
      ipc: ['registerHandler', 'send', 'handleSend']
    })
    this._modules.register(modules)
    this._defaultConfig = this._modules.getDefaultConfig()

    this._state = 'need_config'

    this._ipc = await new IpcServer()

    // hack for module init
    this._ipc.ready = () => {}

    // hack for module init
    this._ipc.registerHandler = fn => {
      this._handlers.push(fn)
    }

    // hack for module init
    this._ipc.handleSend = opt => {
      const id = this._getNextId()
      this._sendHandlerIdWait[id] = {
        resolve: (...args) => {
          delete this._sendHandlerIdWait[id]
          opt.resolve(...args)
        }
      }
      this._ipc.send('json', {
        method: 'handleSend',
        _id: id,
        toAddress: opt.toAddress,
        fromAddress: opt.fromAddress,
        data: opt.data
      })
    }

    this._ipc.on('clientAdd', id => {
      console.log('@@ clientAdd', id)
    })
    this._ipc.on('clientRemove', id => {
      console.log('@@ clientRemove', id)
    })
    this._ipc.on('message', opt => this._handleMessage(opt.name, opt.data))
    await this._ipc.bind(this._ipcUri)

    console.log('bound to', this._ipcUri)
    console.log('#IPC-READY#')
  }

  /**
   */
  async _handleMessage (name, data) {
    if (this.$isDestroyed()) {
      return
    }
    if (name !== 'json') {
      return
    }

    if (data.method === 'handleSendResult' && data._id in this._sendHandlerIdWait) {
      this._sendHandlerIdWait[data._id].resolve(data.data)
      return
    }

    for (let handler of this._handlers) {
      if (await handler(data, (name, data) => {
        this._ipc.send('json', data)
      })) {
        return
      }
    }

    await this._handleUnreadyMessage(name, data)
  }

  /**
   */
  async _handleUnreadyMessage (name, data) {
    if (data.method === 'requestState') {
      this._ipc.send('json', {
        method: 'state',
        state: this._state
      })
    } else if (data.method === 'requestDefaultConfig') {
      this._ipc.send('json', {
        method: 'defaultConfig',
        config: this._defaultConfig
      })
    } else if (data.method === 'setConfig') {
      this._state = 'pending'

      await this._modules.launch(JSON.parse(data.config))
    } else {
      throw new Error('unhandled method: "' + data.method + '" (may be invalid for state: "' + this._state + '"')
    }
  }
}

exports.N3hNode = N3hNode
