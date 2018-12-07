const path = require('path')
const os = require('os')
const { URL } = require('url')

const { AsyncClass, mkdirp, $p } = require('@holochain/n3h-common')
const { IpcServer } = require('@holochain/n3h-ipc')
const { LibP2pBundle } = require('@holochain/n3h-mod-message-libp2p')

const PeerInfo = require('peer-info')
const PeerId = require('peer-id')

const tweetlog = require('@holochain/tweetlog')
tweetlog.set('t')

/// in hackmode, we need to always output on stderr
tweetlog.listen((l, t, ...a) => {
  console.error(`(${t}) [${l}] ${a.map(a => a.stack || a.toString()).join(' ')}`)
})

const log = tweetlog('@hackmode@')

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

    const tmpUri = new URL(this._ipcUri.replace('*', '0'))
    if (tmpUri.protocol === 'ipc:') {
      await mkdirp(path.dirname(tmpUri.pathname))
    }

    await Promise.all([
      this._initIpc(),
      this._initP2p()
    ])

    // make sure this is output despite our log settings
    console.log('#IPC-BINDING#:' + this._ipc.boundEndpoint)
    for (let binding of this._p2p.getBindings()) {
      console.log('#P2P-BINDING#:' + binding)
    }
    console.log('#IPC-READY#')
  }

  async run () {
    log.t('running')
  }

  // -- private -- //

  async _initIpc () {
    this._ipc = await new IpcServer()

    this._ipc.on('clientAdd', id => {
      log.t('clientAdd', id)
    })
    this._ipc.on('clientRemove', id => {
      log.t('clientAdd', id)
    })
    this._ipc.on('message', opt => this._handleIpcMessage(opt))
    this._ipc.boundEndpoint = (await this._ipc.bind(this._ipcUri))[0]

    log.t('bound to', this._ipc.boundEndpoint)
  }

  async _initP2p () {
    const peerInfo = this._peerInfo = new PeerInfo(await $p(PeerId.create.bind(
      PeerId, { bits: 512 })))

    peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0')

    this._p2p = await new LibP2pBundle({
      peerInfo
    })

    this._p2p.on('peerConnected', id => {
      this._ipc.send('json', {
        method: 'peerConnected',
        id: id
      })
    })

    log.i('p2p bound', JSON.stringify(this._p2p.getBindings(), null, 2))
  }

  _handleIpcMessage (opt) {
    if (opt.name === 'ping') {
      return
    }

    if (opt.name === 'json' && typeof opt.data.method === 'string') {
      switch (opt.data.method) {
        case 'requestState':
          this._ipc.send('json', {
            method: 'state',
            state: 'ready',
            id: this._p2p.getId(),
            bindings: this._p2p.getBindings()
          })
          return
        case 'connect':
          this._p2p.connect(opt.data.address)
          return
      }
    }

    throw new Error('unexpected input ' + JSON.stringify(opt))
  }
}

exports.N3hHackMode = N3hHackMode
