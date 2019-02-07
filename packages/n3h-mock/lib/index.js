const path = require('path')
const os = require('os')
const { URL } = require('url')

const { AsyncClass, mkdirp } = require('@holochain/n3h-common')
const { IpcServer } = require('@holochain/n3h-ipc')

const { Mem } = require('./mem')

const tweetlog = require('@holochain/tweetlog')
const log = tweetlog('@mock@')

class N3hMock extends AsyncClass {
  /**
   * Network mock init.
   * Normally spawned by holochain_net where config is passed via environment variables
   */
  async init (workDir) {
    await super.init()

    log.t('Initializing...')

    // Initialize members
    this._memory = {}
    this._senders = {}
    // this.senders_by_dna = {}

    this._publishedEntryBook = {}
    this._storedEntryBook = {}
    this._publishedMetaBook = {}
    this._storedMetaBook = {}

    this._requestBook = {}
    this._requestCount = 0

    this._transferedRequestList = []

    // Set working directory from config (a temp folder) or default to $home/.n3h
    this._workDir = workDir

    // Set ipcUri
    this._ipcUri = 'N3H_IPC_SOCKET' in process.env
      ? process.env.N3H_IPC_SOCKET
      : 'ipc://' + path.resolve(path.join(
        os.homedir(), '.n3h', 'n3h-ipc.socket'))

    const tmpUri = new URL(this._ipcUri.replace('*', '0'))
    if (tmpUri.protocol === 'ipc:') {
      await mkdirp(path.dirname(tmpUri.pathname))
    }

    // Init "submodules"
    await Promise.all([
      this._initIpc()
    ])

    // Notify that Init is done
    // make sure this is output despite our log settings
    console.log('#IPC-BINDING#:' + this._ipc.boundEndpoint)
    console.log('#IPC-READY#')
  }

  /**
   *
   */
  async run () {
    log.t('running')
  }

  // ----------------------------------------------------------------------------------------------
  // Private
  // ----------------------------------------------------------------------------------------------

  /**
   * Set IPC function pointers on message received
   */
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

  /**
   * Received 'message' from IPC: process it
   */
  _handleIpcMessage (opt) {
    if (opt.name === 'ping' || opt.name === 'pong') {
      return
    }

    log.t('Received IPC: ', opt)

    let toZmqId
    let bucketId
    if (opt.name === 'json' && typeof opt.data.method === 'string') {
      switch (opt.data.method) {
        case 'failureResult':
          // Check if its a response to our own request
          bucketId = this._checkRequest(opt.data._id)
          if (bucketId !== '') {
            return
          }
          // if not relay to receipient
          this._ipc.send('json', opt.data)
          return
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
            agentId: opt.data.address
          })

          return
        case 'trackDna':
          this._track(opt.data.dnaAddress, opt.data.agentId, opt.fromZmqId)
          return
        case 'sendMessage':
          this._getMemRef(opt.data.dnaAddress)

          if (!(opt.data.toAgentId in this._senders)) {
            this._ipc.send('json', {
              method: 'failureResult',
              dnaAddress: opt.data.dnaAddress,
              _id: opt.data._id,
              toAgentId: opt.data.fromAgentId,
              errorInfo: 'No routing for agent id "' + opt.data.toAgentId + '" aborting send'
            })
            return
          }

          toZmqId = this._senders[opt.data.toAgentId]
          this._ipc.sendOne(toZmqId, 'json', {
            method: 'handleSendMessage',
            _id: opt.data._id,
            dnaAddress: opt.data.dnaAddress,
            toAgentId: opt.data.toAgentId,
            fromAgentId: opt.data.fromAgentId,
            data: opt.data.data
          })
          return
        case 'handleSendMessageResult':
          this._getMemRef(opt.data.dnaAddress)

          if (!(opt.data.toAgentId in this._senders)) {
            log.t('sendMessage failed: unknown target node: ' + opt.data.toAgentId)
            return
          }
          toZmqId = this._senders[opt.data.toAgentId]

          if (!(opt.data.toAgentId in this._senders)) {
            this._ipc.send('json', {
              method: 'failureResult',
              dnaAddress: opt.data.dnaAddress,
              _id: opt.data._id,
              toAgentId: opt.data.fromAgentId,
              errorInfo: 'No routing for agent id "' + opt.data.toAgentId + '" aborting handleSendMessageResult'
            })
            return
          }
          toZmqId = this._senders[opt.data.toAgentId]
          this._ipc.sendOne(toZmqId, 'json', {
            method: 'sendMessageResult',
            _id: opt.data._id,
            dnaAddress: opt.data.dnaAddress,
            toAgentId: opt.data.toAgentId,
            fromAgentId: opt.data.fromAgentId,
            data: opt.data.data
          })
          return
        case 'publishEntry':
          // Note: opt.data is a EntryData
          // Bookkeep
          this._bookkeepAddress(
            this._publishedEntryBook,
            opt.data.dnaAddress,
            opt.data.providerAgentId,
            opt.data.address
          )
          // TODO: we don't actually need to store the data on the nodejs side, we could just make all the store requests to connected nodes inline here, but that could be an optimization for later.
          this._getMemRef(opt.data.dnaAddress).mem.insert({
            type: 'dhtEntry',
            providerAgentId: opt.data.providerAgentId,
            address: opt.data.address,
            content: opt.data.content
          })
          return
        case 'publishMeta':
          // Note: opt.data is a DhtMetaData
          // Bookkeep each metaId
          for (const metaContent of opt.data.contentList) {
            let metaId = this._intoMetaId(opt.data.entryAddress, opt.data.attribute, metaContent)
            this._bookkeepAddress(this._publishedMetaBook, opt.data.dnaAddress, opt.data.providerAgentId, metaId)
          }
          // Store on all nodes
          this._getMemRef(opt.data.dnaAddress).mem.insert({
            type: 'dhtMeta',
            providerAgentId: opt.data.providerAgentId,
            entryAddress: opt.data.entryAddress,
            attribute: opt.data.attribute,
            contentList: opt.data.contentList
          })
          return
        case 'fetchEntry':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          opt.data.method = 'handleFetchEntry'
          this._ipc.send('json', opt.data)
          return
        case 'handleFetchEntryResult':
          // Note: opt.data is a FetchEntryResultData
          // if this message is a response from our own request, do a publish
          if (opt.data._id in this._requestBook) {
            delete this._requestBook[opt.data._id]
            this._getMemRef(opt.data.dnaAddress).mem.insert({
              type: 'dhtEntry',
              providerAgentId: opt.data.providerAgentId,
              entryAddress: opt.data.address,
              content: opt.data.content
            })
            return
          }
          // otherwise since we're fully connected, just redirect this back to itself for now...
          // Transfer this id only once
          if (this._transferedRequestList.includes(opt.data._id)) {
            return
          }
          this._transferedRequestList.push(opt.data._id)
          opt.data.method = 'fetchEntryResult'
          this._ipc.send('json', opt.data)
          return
        case 'fetchMeta':
          // erm... since we're fully connected,
          // just redirect this back to itself for now...
          opt.data.method = 'handleFetchMeta'
          this._ipc.send('json', opt.data)
          return
        case 'handleFetchMetaResult':
          // Note: opt.data is a FetchMetaResultData
          // if its from our own request, do a publish for each new/unknown meta content
          if (opt.data._id in this._requestBook) {
            bucketId = this._checkRequest(opt.data._id)
            if (bucketId === '') {
              return
            }
            log.t('Handle our handleFetchMetaResult:', opt.data._id, bucketId)
            // get already known publishing list
            let knownPublishingMetaList = []
            if (bucketId in this._publishedMetaBook) {
              knownPublishingMetaList = this._publishedMetaBook[bucketId]
            }
            for (const metaContent of opt.data.contentList) {
              let metaId = this._intoMetaId(opt.data.entryAddress, opt.data.attribute, metaContent)
              if (knownPublishingMetaList.includes(metaId)) {
                continue
              }
              this._getMemRef(opt.data.dnaAddress).mem.insert({
                type: 'dhtMeta',
                providerAgentId: opt.data.providerAgentId,
                entryAddress: opt.data.entryAddress,
                attribute: opt.data.attribute,
                contentList: [metaContent]
              })
            }
            return
          }
          // otherwise since we're fully connected, just redirect this back to itself for now..
          // Transfer this id only once
          if (this._transferedRequestList.includes(opt.data._id)) {
            return
          }
          this._transferedRequestList.push(opt.data._id)
          log.t('Transfer handleFetchMetaResult as fetchMetaResult:', opt.data._id)
          opt.data.method = 'fetchMetaResult'
          this._ipc.send('json', opt.data)
          return

        case 'handleGetPublishingEntryListResult':
          // Note: opt.data is EntryListData
          // Mark my request as resolved and get bucketId from request
          bucketId = this._checkRequest(opt.data._id)
          if (bucketId === '') {
            return
          }
          // get already known publishing list
          let knownPublishingList = []
          if (bucketId in this._publishedEntryBook) {
            knownPublishingList = this._publishedEntryBook[bucketId]
          }
          // Update my book-keeping on what this agent has.
          // and do a getEntry for every new entry
          for (const entryAddress of opt.data.entryAddressList) {
            if (knownPublishingList.includes(entryAddress)) {
              log.t('Entry is known ', entryAddress)
              continue
            }
            let fetchEntry = {
              method: 'handleFetchEntry',
              dnaAddress: opt.data.dnaAddress,
              _id: this._createRequestWithBucket(bucketId),
              requesterAgentId: '',
              address: entryAddress
            }
            this._ipc.send('json', fetchEntry)
          }
          return
        case 'handleGetHoldingEntryListResult':
          // Note: opt.data is EntryListData
          // Mark my request as resolved and get bucketId from request
          bucketId = this._checkRequest(opt.data._id)
          if (bucketId === '') {
            return
          }
          // get already known publishing list
          let knownHoldingList = []
          if (bucketId in this._storedEntryBook) {
            knownHoldingList = this._storedEntryBook[bucketId]
          }
          // Update my book-keeping on what this agent has.
          // and do a getEntry for every new entry
          for (const entryAddress of opt.data.entryAddressList) {
            if (knownHoldingList.includes(entryAddress)) {
              continue
            }
            this._bookkeepAddressWithBucket(this._storedEntryBook, bucketId, entryAddress)
          }
          return

        case 'handleGetPublishingMetaListResult':
          // Note: opt.data is MetaListData
          // Mark my request as resolved and get bucketId from request
          bucketId = this._checkRequest(opt.data._id)
          if (bucketId === '') {
            return
          }

          // get already known publishing list
          let knownPublishingMetaList = []
          if (bucketId in this._publishedMetaBook) {
            knownPublishingMetaList = this._publishedMetaBook[bucketId]
          }

          // Update my book-keeping on what this agent has.
          // and do a getEntry for every new entry
          let requestedMetaKey = []
          for (const metaTuple of opt.data.metaList) {
            let metaId = this._intoMetaId(metaTuple[0], metaTuple[1], metaTuple[2])
            if (knownPublishingMetaList.includes(metaId)) {
              continue
            }
            // dont send same request twice
            const metaKey = '' + metaTuple[0] + '+' + metaTuple[1]
            if (requestedMetaKey.includes(metaKey)) {
              continue
            }
            requestedMetaKey.push(metaKey)

            let fetchMeta = {
              method: 'handleFetchMeta',
              dnaAddress: opt.data.dnaAddress,
              _id: this._createRequestWithBucket(bucketId),
              requesterAgentId: '',
              entryAddress: metaTuple[0],
              attribute: metaTuple[1]
            }
            this._ipc.send('json', fetchMeta)
          }
          return

        case 'handleGetHoldingMetaListResult':
          // Note: opt.data is MetaListData
          // Mark my request as resolved and get bucketId from request
          bucketId = this._checkRequest(opt.data._id)
          if (bucketId === '') {
            return
          }
          // get already known publishing list
          let knownHoldingMetaList = []
          if (bucketId in this._storedMetaBook) {
            knownHoldingMetaList = this._storedMetaBook[bucketId]
          }
          // Update my book-keeping on what this agent has.
          // and do a getEntry for every new entry
          // for (let entryAddress in opt.data.metaList) {
          for (const metaTuple of opt.data.metaList) {
            let metaId = this._intoMetaId(metaTuple[0], metaTuple[1], metaTuple[2])
            if (knownHoldingMetaList.includes(metaId)) {
              continue
            }
            this._bookkeepAddressWithBucket(this._storedMetaBook, bucketId, metaId)
          }
          return
      }
    }

    throw new Error('unexpected input ' + JSON.stringify(opt))
  }

  /**
   * get or create Mem field for the specific dna
   */
  _getMemRef (dnaAddress) {
    if (!(dnaAddress in this._memory)) {
      const mem = new Mem()
      // Add indexer which sends a storeEntry request to core
      mem.registerIndexer((store, hash, data) => {
        if (data && data.type === 'dhtEntry') {
          log.t('got dhtEntry', data)
          this._ipc.send('json', {
            method: 'handleStoreEntry',
            dnaAddress,
            providerAgentId: data.providerAgentId,
            address: data.address,
            content: data.content
          })
        }
      })
      // Add indexer which sends a storeMeta request to core
      mem.registerIndexer((store, hash, data) => {
        if (data && data.type === 'dhtMeta') {
          log.t('got dhtMeta', data)
          this._ipc.send('json', {
            method: 'handleStoreMeta',
            dnaAddress,
            providerAgentId: data.providerAgentId,
            entryAddress: data.entryAddress,
            attribute: data.attribute,
            contentList: data.contentList
          })
        }
      })
      // Add dna specific indexer which maps agent_id to transport_id
      // and sends peerConnected messages
      this._memory[dnaAddress] = {
        mem,
        agentToTransportId: mem.registerIndexer((store, hash, data) => {
          if (data && data.type === 'agent') {
            // log.t('got Peer/Agent', data)
            store[data.agentId] = data.transportId
            this._ipc.send('json', {
              method: 'peerConnected',
              agentId: data.agentId
            })
          }
        })
      }
    }
    return this._memory[dnaAddress]
  }

  /**
   *
   */
  _checkRequest (requestId) {
    if (!(requestId in this._requestBook)) {
      return ''
    }
    let bucketId = this._requestBook[requestId]
    return bucketId
  }

  /**
   *
   */
  _track (dnaAddress, agentId, fromZmqId) {
    const ref = this._getMemRef(dnaAddress)
    // store agent (this will map agentId to transportId)
    ref.mem.insert({
      type: 'agent',
      dnaAddress: dnaAddress,
      agentId: agentId,
      transportId: fromZmqId
    })
    // also map agentId to transportId with in _senders
    // const bucketId = this._catDnaAgent(dnaAddress, agentId)
    // log.t("tracking: '" + bucketId + "' for " + fromZmqId)
    this._senders[agentId] = fromZmqId

    // send all 'get list' requests
    let requestId = this._createRequest(dnaAddress, agentId)
    this._ipc.send('json', {
      method: 'handleGetPublishingEntryList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipc.send('json', {
      method: 'handleGetHoldingEntryList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipc.send('json', {
      method: 'handleGetPublishingMetaList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipc.send('json', {
      method: 'handleGetHoldingMetaList',
      dnaAddress,
      _id: requestId
    })
  }

  _catDnaAgent (DnaHash, AgentId) {
    return '' + DnaHash + '::' + AgentId
  }

  /**
   *   Make a metaId out of a meta
   */
  _intoMetaId (entryAddress, attribute, metaContent) {
    return '' + entryAddress + '||' + attribute + '||' + metaContent
  }

  _generateRequestId () {
    this._requestCount += 1
    return 'req_' + this._requestCount
  }

  _createRequest (dnaAddress, agentId) {
    let bucketId = this._catDnaAgent(dnaAddress, agentId)
    return this._createRequestWithBucket(bucketId)
  }

  _createRequestWithBucket (bucketId) {
    let reqId = this._generateRequestId()
    this._requestBook[reqId] = bucketId
    return reqId
  }

  _bookkeepAddress (book, dnaAddress, agentId, address) {
    const bucketId = this._catDnaAgent(dnaAddress, agentId)
    this._bookkeepAddressWithBucket(book, bucketId, address)
  }

  _bookkeepAddressWithBucket (book, bucketId, address) {
    if (!(bucketId in book)) {
      book[bucketId] = []
    }
    book[bucketId].push(address)
  }
}

exports.N3hMock = N3hMock
