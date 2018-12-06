const path = require('path')
const os = require('os')
const { URL } = require('url')

const { AsyncClass, mkdirp } = require('@holochain/n3h-common')
const { IpcServer } = require('@holochain/n3h-ipc')

class N3hHackMode extends AsyncClass {
  async init () {
    await super.init()

    this._workDir = 'N3H_WORK_DIR' in process.env
      ? process.env.N3H_WORK_DIR
      : path.resolve(path.join(
        os.homedir(), '.nh3'))

    await mkdirp(this._workDir)
    process.chdir(this._workDir)

    this._ipcUri = 'N3H_IPC_SOCKET' in process.env
      ? process.env.N3H_IPC_SOCKET
      : 'ipc://' + path.resolve(path.join(
        os.homedir(), '.n3h', 'n3h-ipc.socket'))

    const tmpUri = new URL(this._ipcUri)
    if (tmpUri.protocol === 'ipc:') {
      await mkdirp(path.dirname(tmpUri.pathname))
    }

    this._ipc = await new IpcServer()

    this._ipc.on('clientAdd', id => {
      console.log('@@ clientAdd', id)
    })
    this._ipc.on('clientRemove', id => {
      console.log('@@ clientRemove', id)
    })
    this._ipc.on('message', opt => this._handleMessage(opt))
    await this._ipc.bind(this._ipcUri)

    console.log('@@ bound to', this._ipcUri)
    console.log('#IPC-READY#')
  }

  async run () {
    console.log('run')
  }
}

exports.N3hHackMode = N3hHackMode
