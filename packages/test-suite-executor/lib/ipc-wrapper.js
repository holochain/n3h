const { AsyncClass } = require('n3h-common')
const { IpcClient } = require('n3h-ipc')

class IpcWrapper extends AsyncClass {
  async init (ipcUri) {
    await super.init()

    this._waitBuckets = {
      state: [],
      defConfig: [],
      getId: [],
      bindings: [],
      connect: [],
      send: []
    }

    this._ipc = await new IpcClient()
    this._ipc.on('message', opt => this._handleMessage(opt.name, opt.data))
    await this._ipc.connect(ipcUri)

    this.$pushDestructor(async () => {
      await this._ipc.destroy()
      this._ipc = null
      this._waitBuckets = null
    })
  }

  requestState () {
    this.$checkDestroyed()
    return new Promise((resolve, reject) => {
      this._waitBuckets.state.push({ resolve, reject })
      this._ipc.send('json', {
        method: 'requestState'
      })
    })
  }

  requestDefaultConfig () {
    this.$checkDestroyed()
    return new Promise((resolve, reject) => {
      this._waitBuckets.defConfig.push({ resolve, reject })
      this._ipc.send('json', {
        method: 'requestDefaultConfig'
      })
    })
  }

  setConfig (config) {
    this.$checkDestroyed()
    this._ipc.send('json', {
      method: 'setConfig',
      config
    })
  }

  getId () {
    this.$checkDestroyed()
    return new Promise((resolve, reject) => {
      this._waitBuckets.getId.push({ resolve, reject })
      this._ipc.send('json', {
        method: 'getId'
      })
    })
  }

  requestBindings () {
    this.$checkDestroyed()
    return new Promise((resolve, reject) => {
      this._waitBuckets.bindings.push({ resolve, reject })
      this._ipc.send('json', {
        method: 'requestBindings'
      })
    })
  }

  connect (address) {
    this.$checkDestroyed()
    return new Promise((resolve, reject) => {
      this._waitBuckets.connect.push({ resolve, reject })
      this._ipc.send('json', {
        method: 'connect',
        address
      })
    })
  }

  send (data) {
    this.$checkDestroyed()
    return new Promise((resolve, reject) => {
      this._waitBuckets.send.push({ resolve, reject })
      this._ipc.send('json', {
        method: 'send',
        toAddress: data.toAddress,
        id: data.id,
        data: data.data
      })
    })
  }

  // -- private -- //

  async _handleMessage (name, data) {
    if (this.$isDestroyed()) {
      return
    }
    if (name !== 'json') {
      return
    }
    if (data.method === 'state') {
      for (let i of this._waitBuckets.state) {
        i.resolve(data)
      }
      this._waitBuckets.state = []
    } else if (data.method === 'defaultConfig') {
      for (let i of this._waitBuckets.defConfig) {
        i.resolve(data)
      }
      this._waitBuckets.defConfig = []
    } else if (data.method === 'id') {
      for (let i of this._waitBuckets.getId) {
        i.resolve(data)
      }
      this._waitBuckets.bindings = []
    } else if (data.method === 'bindings') {
      for (let i of this._waitBuckets.bindings) {
        i.resolve(data)
      }
      this._waitBuckets.bindings = []
    } else if (data.method === 'connect') {
      for (let i of this._waitBuckets.connect) {
        i.resolve(data)
      }
      this._waitBuckets.connect = []
    } else if (data.method === 'sendResult') {
      for (let i of this._waitBuckets.send) {
        i.resolve(data)
      }
      this._waitBuckets.send = []
    } else if (data.method === 'handleSend') {
      const out = 'echo: ' + data.data
      this._ipc.send('json', {
        method: 'send',
        toAddress: data.fromAddress,
        id: out,
        data: out
      })
    }
  }
}

exports.IpcWrapper = IpcWrapper
