const path = require('path')
const os = require('os')
const { URL } = require('url')

const { AsyncClass, mkdirp } = require('@holochain/n3h-common')
const { IpcServer } = require('@holochain/n3h-ipc')

const { Mem } = require('./mem')

const tweetlog = require('@holochain/tweetlog')
tweetlog.set('t')

const log = tweetlog('@mock@')

class N3hMock extends AsyncClass {
  /// Network mock init.
  /// Normally spawned by holochain_net where config is passed via environment variables
  async init () {
    await super.init()

    log.t('Initializing...')

    // Initialize members
    this._memory = {}
    this._senders = {}
    this.senders_by_dna = {}

    // Set working directory from config (a temp folder) or default to $home/.n3h
    this._workDir = 'N3H_WORK_DIR' in process.env
      ? process.env.N3H_WORK_DIR
      : path.resolve(path.join(
        os.homedir(), '.nh3'))

    // Move into working directory?
    await mkdirp(this._workDir)
    process.chdir(this._workDir)

    // Set ipcUri
    this._ipcUri = 'N3H_IPC_SOCKET' in process.env
      ? process.env.N3H_IPC_SOCKET
      : 'ipc://' + path.resolve(path.join(
        os.homedir(), '.n3h', 'n3h-ipc.socket'))

    const tmpUri = new URL(this._ipcUri.replace('*', '0'))
    if (tmpUri.protocol === 'ipc:') {
      await mkdirp(path.dirname(tmpUri.pathname))
    }

    // Init "submodules" ?
    await Promise.all([
      this._initIpc()
    ])

    // Notify that Init is done
    // make sure this is output despite our log settings
    console.log('#IPC-BINDING#:' + this._ipc.boundEndpoint)
    console.log('#IPC-READY#')
  }

  //
  async run () {
    log.t('running')
  }

  // ----------------------------------------------------------------------------------------------
  // Private
  // ----------------------------------------------------------------------------------------------

  // Set IPC function pointers on message received
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

  // Received 'message' from IPC: process it
  _handleIpcMessage (opt) {
    if (opt.name === 'ping') {
      return
    }

    log.t('Received IPC message: ', opt)

    let toZmqId
    if (opt.name === 'json' && typeof opt.data.method === 'string') {
      switch (opt.data.method) {
        case 'requestState':
          this._ipc.send('json', {
            method: 'state',
            state: 'ready',
            id: '42', // not needed in mock mode
            bindings: [] // not needed in mock mode
          })
          return
        case 'connect':
          // maybe log an error?
          this._ipc.send('json', {
            method: 'peerConnected',
            id: opt.data.address
          })

          return
        case 'trackApp':
          this._track(opt.data.dnaAddress, opt.data.agentId, opt.fromZmqId)
          return
        case 'send':
          this._getMemRef(opt.data.dnaAddress)

          if (!(opt.data.toAgentId in this._senders)) {
            this._ipc.send('json', {
              method: 'failureResult',
              dnaAddress: opt.data.dnaAddress,
              toAgentId: opt.data.fromAgentId,
              errorInfo: 'No routing for agent id "' + opt.data.toAgentId + '" aborting send'
            })
            return
          }

          toZmqId = this._senders[opt.data.toAgentId]
          this._ipc.sendOne(toZmqId, 'json', {
            method: 'handleSend',
            _id: opt.data._id,
            dnaAddress: opt.data.dnaAddress,
            toAgentId: opt.data.toAgentId,
            fromAgentId: opt.data.fromAgentId,
            data: opt.data.data
          })
          return
        case 'handleSendResult':
          this._getMemRef(opt.data.dnaAddress)

          if (!(opt.data.toAgentId in this._senders)) {
            log.t('send failed: unknown target node: ' + opt.data.toAgentId)
            return
          }
          toZmqId = this._senders[opt.data.toAgentId]

          if (!(opt.data.toAgentId in this._senders)) {
            this._ipc.send('json', {
              method: 'failureResult',
              dnaAddress: opt.data.dnaAddress,
              toAgentId: opt.data.fromAgentId,
              errorInfo: 'No routing for agent id "' + opt.data.toAgentId + '" aborting handleSendResult'
            })
            return
          }
          toZmqId = this._senders[opt.data.toAgentId]
          this._ipc.sendOne(toZmqId, 'json', {
            method: 'sendResult',
            _id: opt.data._id,
            dnaAddress: opt.data.dnaAddress,
            toAgentId: opt.data.toAgentId,
            fromAgentId: opt.data.fromAgentId,
            data: opt.data.data
          })
          return
        case 'publishDht':
          // TODO: we don't actually need to store the data on the nodejs side, we could just make all the store requests to connected nodes inline here, but that could be an optimization for later.
          this._getMemRef(opt.data.dnaAddress).mem.insert({
            type: 'dht',
            _id: opt.data._id,
            agentId: opt.data.agentId,
            address: opt.data.address,
            content: opt.data.content
          })
          return
        case 'publishDhtMeta':
          this._getMemRef(opt.data.dnaAddress).mem.insert({
            type: 'dhtMeta',
            _id: opt.data._id,
            agentId: opt.data.agentId,
            fromAgentId: opt.data.fromAgentId,
            address: opt.data.address,
            attribute: opt.data.attribute,
            content: opt.data.content
          })
          return
        case 'getDht':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          this._ipc.send('json', opt.data)
          return
        case 'getDhtResult':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          this._ipc.send('json', opt.data)
          return
        case 'getDhtMeta':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          this._ipc.send('json', opt.data)
          return
        case 'getDhtMetaResult':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          this._ipc.send('json', opt.data)
          return
      }
    }

    throw new Error('unexpected input ' + JSON.stringify(opt))
  }

  _getMemRef (dnaAddress) {
    if (!(dnaAddress in this._memory)) {
      const mem = new Mem()
      mem.registerIndexer((store, hash, data) => {
        if (data && data.type === 'dht') {
          this._ipc.send('json', {
            method: 'storeDht',
            _id: data._id,
            dnaAddress,
            agentId: data.agentId,
            address: data.address,
            content: data.content
          })
        }
      })
      mem.registerIndexer((store, hash, data) => {
        if (data && data.type === 'dhtMeta') {
          log.e('got dhtMeta', data)
          this._ipc.send('json', {
            method: 'storeDhtMeta',
            _id: data._id,
            dnaAddress,
            agentId: data.agentId,
            address: data.address,
            fromAgentId: data.fromAgentId,
            attribute: data.attribute,
            content: data.content
          })
        }
      })
      this._memory[dnaAddress] = {
        mem,
        agentToTransportId: mem.registerIndexer((store, hash, data) => {
          if (data && data.type === 'agent') {
            store[data.agentId] = data.transportId
            this._ipc.send('json', {
              method: 'peerConnected',
              dnaAddress: dnaAddress,
              agentId: data.agentId
            })
          }
        })
      }
    }
    return this._memory[dnaAddress]
  }

  _CatDnaAgent (DnaHash, AgentId) {
    return DnaHash + '::' + AgentId
  }

  _track (dnaAddress, agentId, fromZmqId) {
    const ref = this._getMemRef(dnaAddress)
    ref.mem.insert({
      type: 'agent',
      dnaAddress: dnaAddress,
      agentId: agentId,
      transportId: fromZmqId
    })

    const uid = this._CatDnaAgent(dnaAddress, agentId)
    log.t("tracking: '" + uid + "' for " + fromZmqId)
    this._senders[agentId] = fromZmqId
  }
}

exports.N3hMock = N3hMock
