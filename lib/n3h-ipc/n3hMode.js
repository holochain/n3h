const msgpack = require('msgpack-lite')

const { AsyncClass } = require('../n3h-common')

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
 * {
 *   "webproxy": {
 *     "connection": {
 *       "rsaBits": 1024,
 *       "bind": [
 *         "wss://0.0.0.0:0/"
 *       ]
 *     },
 *     "wssAdvertise": "auto",
 *     "wssRelayPeers": null
 *   }
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
  async init (workDir, rawConfigData, terminate) {
    await super.init()

    this._config = await config(rawConfigData || {})
    log.i('@@ CONFIG @@', JSON.stringify(this._config, null, 2))

    this._terminate = terminate || (() => {})
    this._trackConsForTerminate = null

    this._memory = {}

    // Book: Array of aspectAddress per entryAddress per Dna
    // i.e. (dnaAddress -> (entryAddress -> [aspectAddress])))
    this._authoredEntryBook = {}
    this._storedEntryBook = {}

    this._requestCount = 0
    // Map of requestId -> ChainId
    // Used for knowing for which agent and dna a request was to/from
    this._requestBook = new Map()

    // Map of AgentId -> [dnaAddress]
    // Can also serve as a list of known local agents
    this._agentTracks = new Map()

    this._workDir = workDir

    await Promise.all([this._initIpc()])

    this.$pushDestructor(async () => {
      if (this._ipc) {
        this._ipcSend('terminated')
        for (let id of this._ipc.keys()) {
          log.t('TERMINATED - closing', id)
          await this._ipc.close(id)
        }
        await this._ipc.destroy()
      }
      this._ipc = null

      this._requestBook.clear()
      this._requestBook = null
    })

    // make sure this is output despite our log settings
    console.log('#IPC-BINDING#:' + this._ipcBoundUri)
    console.log('#IPC-READY#')
  }

  //
  async run () {
    log.t('running')
  }

  getIpcBinding () {
    return this._ipcBoundUri
  }

  // -- private -- //

  /**
   * @private
   */
  async _initIpc () {
    this._ipc = (await new ConnectionBackendWss({
      // TODO - allow some kind of environment var?? for setting passphrase
      passphrase: 'hello',
      rsaBits: this._config.ipc.connection.rsaBits,
      bind: this._config.ipc.connection.bind
    })).connectionInterface
    this._ipc.on('event', ev => this._handleIpcEvent(ev))
    await Promise.all(this._config.ipc.connection.bind.map(b => this._ipc.bind(b)))
    log.t('bound to', this._ipcBoundUri)
  }

  /**
   * @private
   */
  _ipcSendOne (key, type, data) {
    // log.t('Sending to IPC:', key, data)
    switch (type) {
      case 'json':
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
    log.t('Sending to IPC:', data)
    switch (type) {
      case 'json':
        let msg = Buffer.from(JSON.stringify(data), 'utf8')
        msg = msgpack.encode({ name: 'json', data: msg }).toString('base64')
        // for now just sending to everything
        this._ipc.send(Array.from(this._ipc.keys()), msg)
        break
      case 'terminated':
        let signal = msgpack.encode({ name: 'terminated', data: '' }).toString('base64')
        this._ipc.send(Array.from(this._ipc.keys()), signal)
        break
      default:
        throw new Error('unexpected ipc send type: ' + type)
    }
  }

  /**
   * @private
   */
  _handleIpcEvent (ev) {
    // log.t('Received from IPC:', ev)
    switch (ev.type) {
      case 'bind':
        if (!this._ipcBoundUri) {
          this._ipcBoundUri = ev.boundUriList[0]
        } else {
          log.w('n3h already bound')
        }
        break
      case 'close':
        if (typeof this._trackConsForTerminate !== 'number') {
          throw new Error('hey? close without connect?')
        } else {
          --this._trackConsForTerminate
        }
        if (this._trackConsForTerminate === 0) {
          log.w('last ipc connection closed, shutting down')
          this._terminate()
        }
        break
      case 'connection':
        if (typeof this._trackConsForTerminate !== 'number') {
          this._trackConsForTerminate = 1
        } else {
          ++this._trackConsForTerminate
        }
        break
      case 'message':
        const dataPre = msgpack.decode(Buffer.from(ev.buffer, 'base64'))
        const name = dataPre.name.toString()
        // log.t('Received from IPC: message:', name)
        switch (name) {
          case 'shutdown':
            this._terminate()
            break
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
  _hasTrack (agentId, dnaAddress) {
    // log.t('_hasTrack:', agentId, dnaAddress)
    if (!this._agentTracks.has(agentId)) {
      return false
    }
    const dnas = this._agentTracks.get(agentId)
    // log.t('_hasTrack()', dnas.has(dnaAddress))
    return dnas.has(dnaAddress)
  }

  /**
   * @private
   */
  _addTrack (agentId, dnaAddress) {
    log.t('_addTrack:', agentId, dnaAddress)
    let dnas
    if (!this._agentTracks.has(agentId)) {
      dnas = new Set()
    } else {
      dnas = this._agentTracks.get(agentId)
    }
    dnas.add(dnaAddress)
    this._agentTracks.set(agentId, dnas)
  }

  /**
   * @private
   */
  _removeTrack (agentId, dnaAddress) {
    log.t('_removeTrack:', agentId, dnaAddress)
    let dnas
    if (!this._agentTracks.has(agentId)) {
      return
    }
    dnas = this._agentTracks.get(agentId)
    dnas.delete(dnaAddress)
    this._agentTracks.set(agentId, dnas)
  }

  /**
   *  Check if agent is tracking dna.
   *  If not, will try to send a FailureResult back to IPC
   *  Returns _hasTrack() result
   *  @private
   */
  _hasTrackOrFail (agentId, dnaAddress, requestId) {
    // Check if receiver is known
    if (this._hasTrack(agentId, dnaAddress)) {
      log.t(' oooo HasTrack() CHECK OK for (agent) "' + agentId + '" -> (DNA) "' + dnaAddress + '"')
      return true
    }
    // Send FailureResult back to IPC
    log.e(' #### HasTrack() CHECK FAILED for (agent) "' + agentId + '" -> (DNA) "' + dnaAddress + '"')
    this._ipcSend('json', {
      method: 'failureResult',
      dnaAddress: dnaAddress,
      _id: requestId,
      toAgentId: agentId,
      resultInfo: [...Buffer.from('This agent is not tracking DNA: "' + dnaAddress + '"')]
    })
    // Done
    return false
  }

  _intoChainId (dnaAddress, agentId) {
    if (dnaAddress === undefined || agentId === undefined) {
      throw new Error('_intoChainId() failed because of undefined argument')
    }
    return '' + dnaAddress + '::' + agentId
  }

  _deconstructChainId (chainId) {
    return chainId.split('::')
  }

  _generateRequestId () {
    this._requestCount += 1
    return 'req_' + this._requestCount
  }

  /**
   * create and return a new request_id
   * @private
   */
  _createRequest (dnaAddress, agentId) {
    const chainId = this._intoChainId(dnaAddress, agentId)
    return this._createRequestWithChainId(chainId)
  }

  /**
   * @private
   */
  _createRequestWithChainId (chainId) {
    if (!chainId || typeof chainId !== 'string' || !chainId.length) {
      throw new Error('cannot createRequest without chainId')
    }
    let reqId = this._generateRequestId()
    this._requestBook.set(reqId, chainId)
    return reqId
  }

  /**
   * @private
   */
  _bookkeepAspect (entryBook, chainId, entryAddress, aspectAddress) {
    if (!(chainId in entryBook)) {
      entryBook[chainId] = {}
    }
    if (!(entryAddress in entryBook[chainId])) {
      entryBook[chainId][entryAddress] = new Set()
      entryBook[chainId][entryAddress].toJSON = function () { return Array.from(this.keys()) }
    }
    let aspectAddressList = entryBook[chainId][entryAddress]
    aspectAddressList.add(aspectAddress)
  }

  /**
   * @private
   */
  _hasEntryAspect (chainId, entryAddress, aspectAddress) {
    if (!(chainId in this._storedEntryBook)) {
      return false
    }
    if (!(entryAddress in this._storedEntryBook[chainId])) {
      return false
    }
    return this._storedEntryBook[chainId][entryAddress].has(aspectAddress)
  }
}

exports.N3hMode = N3hMode
