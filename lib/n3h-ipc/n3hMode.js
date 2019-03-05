const msgpack = require('msgpack-lite')

const { AsyncClass } = require('../n3h-common')

const { Connection } = require('../n3h-mod-spec')
const { ConnectionBackendWss } = require('../n3h-mod-connection-wss')

const config = require('../hackmode/config')

const tweetlog = require('../tweetlog')
const log = tweetlog('*n3hMode*')

/**
 * Common N3h Mode code
 *
 * Expects a config either over stdin or as a file `n3h-config.json` in the
 * working directory.
 * If neither is supplied, will load up the following default:
 *
 * ```
 * "webproxy": {
 *   "connection": {
 *     "rsaBits": 1024,
 *     "bind": [
 *       "wss://0.0.0.0:0/"
 *     ]
 *   },
 *   "wssAdvertise": "auto",
 *   "wssRelayPeers": null
 * }
 * ```
 *
 * Config Definitions:
 *
 * - `webproxy.connection.rsaBits` {number} - rsa bits to use for tls on websocket server
 * - `webproxy.connection.bind` {array<uri>} - uri array of NICs to bind the websocket server. use host `0.0.0.0` for "all" NICs, use port `0` for random (os-assigned) port. You can specify a path, e.g. `"wss://127.0.0.1:8443/test/path/"`
 * - `webproxy.wssAdvertise` {uri|"auto"} - Cannot be paired with `wssRelayPeers`. Sets up this node to be directly connectable at this address. Special case if set to `"auto"` will pick the first public NIC binding... allowing for os-assigned ports.
 * - `webproxy.wssRelayPeers` {array<uri>} - Cannot be paired with `wssAdvertise`. Uri array of relay peers to connect through. (currently you can only specify 1). Use this if behind a NAT, all messages will be routed through the peer specified here.
 */
class N3hMode extends AsyncClass {
  async init (workDir, rawConfigData) {
    await super.init()

    this._config = config(rawConfigData || {})
    log.i('@@ CONFIG @@', JSON.stringify(this._config, null, 2))

    this._memory = {}

    // Book: Array of entryAddress (or metaId) per dna
    this._publishedEntryBook = {}
    this._storedEntryBook = {}
    this._publishedMetaBook = {}
    this._storedMetaBook = {}

    this._requestCount = 0

    // Map of AgentId -> DNAs
    // Can also serve as a list of known local agents
    this._ipcDnaByAgent = new Map()

    this._workDir = workDir

    await Promise.all([this._initIpc()])

    // make sure this is output despite our log settings
    console.log('#IPC-BINDING#:' + this._ipcBoundUri)
    console.log('#IPC-READY#')
  }

  //
  async run () {
    log.t('running')
  }

  // -- private -- //

  /**
   * @private
   */
  async _initIpc () {
    this._ipc = await new Connection(ConnectionBackendWss, {
      // TODO - allow some kind of environment var?? for setting passphrase
      passphrase: 'hello',
      rsaBits: this._config.ipc.connection.rsaBits,
      bind: this._config.ipc.connection.bind
    })
    this._ipc.on('event', ev => this._handleIpcEvent(ev))
    await Promise.all(this._config.ipc.connection.bind.map(b => this._ipc.bind(b)))
    log.t('bound to', this._ipcBoundUri)
  }

  /**
   * @private
   */
  _ipcSendOne (key, type, data) {
    switch (type) {
      case 'json':
        log.t('_ipcSendOne', data)
        let msg = Buffer.from(JSON.stringify(data), 'utf8')
        msg = msgpack.encode({ name: 'json', data: msg }).toString('base64')
        this._ipc.send([key], msg)
        break
      default:
        throw new Error('unexpected ipc sendOne type: ' + type)
    }
  }

  /**
   * @private
   */
  _ipcSend (type, data) {
    switch (type) {
      case 'json':
        let msg = Buffer.from(JSON.stringify(data), 'utf8')
        msg = msgpack.encode({ name: 'json', data: msg }).toString('base64')
        // for now just sending to everything
        this._ipc.send(Array.from(this._ipc.keys()), msg)
        break
      default:
        throw new Error('unexpected ipc send type: ' + type)
    }
  }

  /**
   * @private
   */
  _handleIpcEvent (ev) {
    // log.t('received IPC event', ev)
    switch (ev.type) {
      case 'bind':
        if (!this._ipcBoundUri) {
          this._ipcBoundUri = ev.boundUriList[0]
        } else {
          log.w('n3h already bound')
        }
        break
      case 'close':
      case 'connection':
        // we don't need to do anything here
        break
      case 'message':
        const dataPre = msgpack.decode(Buffer.from(ev.buffer, 'base64'))
        const name = dataPre.name.toString()
        switch (name) {
          case 'json':
            const data = JSON.parse(dataPre.data.toString('utf8'))
            if (typeof data.method !== 'string') {
              throw new Error('bad json msg: ' + JSON.stringify(data))
            }
            this._handleIpcJson(data, ev.id)
            break
          default:
            throw new Error('unexpected msg type: ' + name)
        }
        break
      default:
        throw new Error('unexpected ipc event type: ' + JSON.stringify(ev))
    }
  }

  /**
   * @private
   */
  _ipcHasTrack (agentId, dnaAddress) {
    log.t('_ipcHasTrack:', agentId, dnaAddress)
    if (!this._ipcDnaByAgent.has(agentId)) {
      return false
    }
    const dnas = this._ipcDnaByAgent.get(agentId)
    log.t('_ipcHasTrack()', dnas.has(dnaAddress))
    return dnas.has(dnaAddress)
  }

  /**
   * @private
   */
  _ipcAddTrack (agentId, dnaAddress) {
    log.t('_ipcAddTrack:', agentId, dnaAddress)
    let dnas
    if (!this._ipcDnaByAgent.has(agentId)) {
      dnas = new Set()
    } else {
      dnas = this._ipcDnaByAgent.get(agentId)
    }
    dnas.add(dnaAddress)
    this._ipcDnaByAgent.set(agentId, dnas)
  }

  /**
   * @private
   */
  _ipcRemoveTrack (agentId, dnaAddress) {
    log.t('_ipcRemoveTrack:', agentId, dnaAddress)
    let dnas
    if (!this._ipcDnaByAgent.has(agentId)) {
      return
    }
    dnas = this._ipcDnaByAgent.get(agentId)
    dnas.delete(dnaAddress)
    this._ipcDnaByAgent.set(agentId, dnas)
  }

  /**
   *  Check if agent is tracking dna.
   *  If not, will try to send a FailureResult back to IPC
   *  Returns _ipcHasTrack() result
   *  @private
   */
  _hasTrackOrFail (agentId, dnaAddress, requestId) {
    // Check if receiver is known
    if (this._ipcHasTrack(agentId, dnaAddress)) {
      log.t('oooo HasTrack() CHECK OK for agent "' + agentId + '" -> DNA "' + dnaAddress + '"')
      return true
    }
    // Send FailureResult back to IPC
    log.e('#### HasTrack() CHECK FAILED for agent "' + agentId + '" -> DNA "' + dnaAddress + '"')
    this._ipcSend('json', {
      method: 'failureResult',
      dnaAddress: dnaAddress,
      _id: requestId,
      toAgentId: agentId,
      errorInfo: 'This agent is not tracking DNA "' + dnaAddress + '"'
    })
    // Done
    return false
  }

  /**
   *  Check if agent is tracking dna.
   *  If not, will try to send a FailureResult back to sender (if sender info is provided).
   *  Returns transportId of receiverAgentId if agent is tracking dna.
   *  @private
   */
  _getTransportIdOrFail (dnaAddress, receiverAgentId, senderAgentId, requestId) {
    // get memory slice
    let ref = this._getMemRef(dnaAddress)
    // Check if receiver is known
    if (ref.agentToTransportId[receiverAgentId]) {
      log.t('oooo CHECK OK for "' + receiverAgentId + '" for DNA "' + dnaAddress + '" = ' + ref.agentToTransportId[receiverAgentId])
      return ref.agentToTransportId[receiverAgentId]
    }
    // Send FailureResult back to IPC, should be senderAgentId
    log.e('#### Check failed for "' + receiverAgentId + '" for DNA "' + dnaAddress + '"')
    this._ipcSend('json', {
      method: 'failureResult',
      dnaAddress: dnaAddress,
      _id: requestId,
      toAgentId: senderAgentId,
      errorInfo: 'No routing for agent id "' + receiverAgentId + '"'
    })
    // Done
    return null
  }
}

exports.N3hMode = N3hMode
