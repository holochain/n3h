const { AsyncClass } = require('@holochain/n3h-common')
const { IpcClient } = require('@holochain/n3h-ipc')

class IpcWrapper extends AsyncClass {
  async init (ipcUri) {
    await super.init()

    this._unhandledMessages = []

    this._genericWait = {}
    this._idWait = {}

    this._ipc = await new IpcClient()
    this._ipc.on('message', opt => this._handleMessage(opt.name, opt.data))
    await this._ipc.connect(ipcUri)

    this.$pushDestructor(async () => {
      await this._ipc.destroy()
      this._ipc = null
      this._unhandledMessages = null
      this._genericWait = null
      this._idWait = null
    })
  }

  getUnhandled () {
    return this._unhandledMessages.shift()
  }

  requestState () {
    this.$checkDestroyed()
    this._ipc.send('json', {
      method: 'requestState'
    })
    return this._postGenericWait('state')
  }

  requestDefaultConfig () {
    this.$checkDestroyed()
    this._ipc.send('json', {
      method: 'requestDefaultConfig'
    })
    return this._postGenericWait('defaultConfig')
  }

  setConfig (config) {
    this.$checkDestroyed()
    this._ipc.send('json', {
      method: 'setConfig',
      config
    })
  }

  connect (address) {
    this.$checkDestroyed()
    this._ipc.send('json', {
      method: 'connect',
      address
    })
  }

  send (data) {
    this.$checkDestroyed()
    const { id, promise } = this._postIdWait()
    this._ipc.send('json', {
      method: 'send',
      _id: id,
      toAddress: data.toAddress,
      data: data.data
    })
    return promise
  }

  // -- private -- //

  _postGenericWait (eventName, timeoutMs) {
    timeoutMs || (timeoutMs = 2000)
    const innerStack = (new Error('stack')).stack
    return new Promise((resolve, reject) => {
      try {
        const timer = setTimeout(() => {
          cleanup()
          reject(new Error('timeout: ' + innerStack))
        }, timeoutMs)
        const cleanup = () => {
          clearTimeout(timer)
        }
        try {
          if (!(eventName in this._genericWait)) {
            this._genericWait[eventName] = []
          }
          this._genericWait[eventName].push({
            resolve: (...args) => {
              cleanup()
              resolve(...args)
            }
          })
        } catch (e) {
          cleanup()
          reject(e)
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  _getNextId () {
    this._lastId || (this._lastId = Math.random())
    this._lastId += 1 + Math.random()
    return this._lastId.toString(36)
  }

  _postIdWait (timeoutMs) {
    const id = this._getNextId()
    timeoutMs || (timeoutMs = 2000)
    const innerStack = (new Error('stack')).stack
    let promise = new Promise((resolve, reject) => {
      try {
        const timer = setTimeout(() => {
          cleanup()
          reject(new Error('timeout: ' + innerStack))
        }, timeoutMs)
        const cleanup = () => {
          delete this._idWait[id]
          clearTimeout(timer)
        }
        try {
          this._idWait[id] = {
            resolve: (...args) => {
              cleanup()
              resolve(...args)
            }
          }
        } catch (e) {
          cleanup()
          reject(e)
        }
      } catch (e) {
        reject(e)
      }
    })
    return { id, promise }
  }

  async _handleMessage (name, data) {
    if (this.$isDestroyed()) {
      return
    }
    if (name !== 'json') {
      return
    }

    if (data._id && data._id in this._idWait) {
      this._idWait[data._id].resolve(data)
      return
    }

    if (data.method in this._genericWait) {
      for (let i of this._genericWait[data.method]) {
        i.resolve(data)
      }
      this._genericWait[data.method] = []
      return
    }

    if (data.method === 'handleSend') {
      const message = 'echo: ' + data.data
      this._ipc.send('json', {
        method: 'handleSendResult',
        _id: data._id,
        data: message
      })
      return
    }

    this._unhandledMessages.push(data)
  }
}

exports.IpcWrapper = IpcWrapper
