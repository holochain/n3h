
const { N3hMode } = require('../n3h-ipc/n3hMode')

const { Mem } = require('./mem')

const tweetlog = require('../tweetlog')
const log = tweetlog('@mock@')

class N3hMock extends N3hMode {
  /**
   * Network mock init.
   * Normally spawned by holochain_net where config is passed via environment variables
   */
  async init (workDir, rawConfigData) {
    await super.init(workDir, rawConfigData)

    this._requestBook = {}

    // Initialize members
    this._transferedRequestList = []

    // make sure this is output despite our log settings
    console.log('#P2P-BINDING#:' + 'ws://127.0.0.1/')
    console.log('#P2P-READY#')
  }

  // ----------------------------------------------------------------------------------------------
  // Private
  // ----------------------------------------------------------------------------------------------

  /**
   * Received 'message' from IPC: process it
   */
  _handleIpcJson (data, senderId) {
    log.t('Received IPC from', senderId, data)

    let mId
    let bucketId
    switch (data.method) {
      case 'failureResult':
        // Note: data is a FailureResultData
        // Check if its a response to our own request
        bucketId = this._checkRequest(data._id)
        if (bucketId !== '') {
          return
        }
        // if not relay to receipient if possible
        mId = this._getPeerAddressOrFail(data.dnaAddress, data.toAgentId)
        if (mId === null) {
          return
        }
        log.t('Received failureResult, forwarding from/to', senderId, mId)
        this._ipcSendOne(mId, 'json', data)
        return
      case 'requestState':
        this._ipcSendOne(senderId, 'json', {
          method: 'state',
          state: 'ready',
          id: '42', // not needed in mock mode
          bindings: [] // not needed in mock mode
        })
        return
      case 'connect':
        // maybe log an error?
        this._ipcSend('json', {
          method: 'peerConnected',
          agentId: data.address
        })

        return
      case 'trackDna':
        // Note: data is a TrackDnaData
        this._track(data.dnaAddress, data.agentId, senderId)
        return
      case 'untrackDna':
        // Note: data is a TrackDnaData
        this._untrack(data.dnaAddress, data.agentId)
        return
      case 'sendMessage':
        // Note: data is a MessageData
        // Sender must TrackDna
        if (!this._hasTrackOrFail(data.fromAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Receiver must TrackDna
        if (!this._hasTrackOrFail(data.toAgentId, data.dnaAddress, data._id)) {
          return
        }
        mId = this._getPeerAddressOrFail(data.dnaAddress, data.toAgentId, data.fromAgentId, data._id)
        if (mId === null) {
          return
        }
        this._ipcSendOne(mId, 'json', {
          method: 'handleSendMessage',
          _id: data._id,
          dnaAddress: data.dnaAddress,
          toAgentId: data.toAgentId,
          fromAgentId: data.fromAgentId,
          data: data.data
        })
        return
      case 'handleSendMessageResult':
        // Note: data is a MessageData
        // Sender must TrackDna
        if (!this._hasTrackOrFail(data.fromAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Receiver must TrackDna
        if (!this._hasTrackOrFail(data.toAgentId, data.dnaAddress, data._id)) {
          return
        }
        mId = this._getPeerAddressOrFail(data.dnaAddress, data.toAgentId, data.fromAgentId, data._id)
        if (mId === null) {
          return
        }
        this._ipcSendOne(mId, 'json', {
          method: 'sendMessageResult',
          _id: data._id,
          dnaAddress: data.dnaAddress,
          toAgentId: data.toAgentId,
          fromAgentId: data.fromAgentId,
          data: data.data
        })
        return
      case 'publishEntry':
        // Note: data is a EntryData
        if (!this._hasTrackOrFail(data.providerAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Bookkeep
        this._bookkeepAddress(
          this._publishedEntryBook,
          data.dnaAddress,
          data.providerAgentId,
          data.address
        )
        // TODO: we don't actually need to store the data on the nodejs side, we could just make all the store requests to connected nodes inline here, but that could be an optimization for later.
        this._getMemRef(data.dnaAddress).mem.insert({
          type: 'dhtEntry',
          providerAgentId: data.providerAgentId,
          address: data.address,
          content: data.content
        })
        return
      case 'publishMeta':
        // Note: opt.data is a DhtMetaData
        if (!this._hasTrackOrFail(data.providerAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Bookkeep each metaId
        for (const metaContent of data.contentList) {
          let metaId = this._intoMetaId(data.entryAddress, data.attribute, metaContent)
          this._bookkeepAddress(this._publishedMetaBook, data.dnaAddress, data.providerAgentId, metaId)
        }
        // Store on all nodes
        this._getMemRef(data.dnaAddress).mem.insert({
          type: 'dhtMeta',
          providerAgentId: data.providerAgentId,
          entryAddress: data.entryAddress,
          attribute: data.attribute,
          contentList: data.contentList
        })
        return
      case 'fetchEntry':
        // Note: data is a FetchEntryData
        if (!this._hasTrackOrFail(data.requesterAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Since we're fully connected, just redirect this back to itself for now...
        data.method = 'handleFetchEntry'
        this._ipcSendOne(senderId, 'json', data)
        return
      case 'handleFetchEntryResult':
        // Note: data is a FetchEntryResultData
        // if this message is a response from our own request, do a publish
        if (data._id in this._requestBook) {
          delete this._requestBook[data._id]
          this._getMemRef(data.dnaAddress).mem.insert({
            type: 'dhtEntry',
            providerAgentId: data.providerAgentId,
            address: data.address,
            content: data.content
          })
          return
        }
        // Requester must track DNA
        mId = this._getPeerAddressOrFail(data.dnaAddress, data.requesterAgentId)
        if (mId === null) {
          return
        }
        // Transfer this id only once
        if (this._transferedRequestList.includes(data._id)) {
          return
        }
        this._transferedRequestList.push(data._id)
        data.method = 'fetchEntryResult'
        this._ipcSendOne(mId, 'json', data)
        return
      case 'fetchMeta':
        // Note: data is a FetchMetaData
        // requester must track dna
        if (!this._hasTrackOrFail(data.requesterAgentId, data.dnaAddress, data._id)) {
          return
        }
        // Since we're fully connected, just redirect this back to itself for now...
        data.method = 'handleFetchMeta'
        this._ipcSendOne(senderId, 'json', data)
        return
      case 'handleFetchMetaResult':
        // Note: data is a FetchMetaResultData
        // if its from our own request, do a publish for each new/unknown meta content
        if (data._id in this._requestBook) {
          bucketId = this._checkRequest(data._id)
          if (bucketId === '') {
            return
          }
          // get already known publishing list
          let knownPublishingMetaList = []
          if (bucketId in this._publishedMetaBook) {
            knownPublishingMetaList = this._publishedMetaBook[bucketId]
          }
          for (const metaContent of data.contentList) {
            let metaId = this._intoMetaId(data.entryAddress, data.attribute, metaContent)
            if (knownPublishingMetaList.includes(metaId)) {
              continue
            }
            this._getMemRef(data.dnaAddress).mem.insert({
              type: 'dhtMeta',
              providerAgentId: data.providerAgentId,
              entryAddress: data.entryAddress,
              attribute: data.attribute,
              contentList: [metaContent]
            })
          }
          return
        }
        // Requester must track DNA
        mId = this._getPeerAddressOrFail(data.dnaAddress, data.requesterAgentId)
        if (mId === null) {
          return
        }
        // Transfer this id only once
        if (this._transferedRequestList.includes(data._id)) {
          return
        }
        this._transferedRequestList.push(data._id)
        log.t('Transfer handleFetchMetaResult as fetchMetaResult:', data._id)
        data.method = 'fetchMetaResult'
        this._ipcSendOne(mId, 'json', data)
        return

      case 'handleGetPublishingEntryListResult':
        // Note: data is EntryListData
        // Mark my request as resolved and get bucketId from request
        bucketId = this._checkRequest(data._id)
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
        for (const entryAddress of data.entryAddressList) {
          if (knownPublishingList.includes(entryAddress)) {
            log.t('Entry is known ', entryAddress)
            continue
          }
          let fetchEntry = {
            method: 'handleFetchEntry',
            dnaAddress: data.dnaAddress,
            _id: this._createRequestWithBucket(bucketId),
            requesterAgentId: '',
            address: entryAddress
          }
          this._ipcSendOne(senderId, 'json', fetchEntry)
        }
        return
      case 'handleGetHoldingEntryListResult':
        // Note: data is EntryListData
        // Mark my request as resolved and get bucketId from request
        bucketId = this._checkRequest(data._id)
        if (bucketId === '') {
          return
        }
        // get already known publishing list
        let knownHoldingList = []
        if (bucketId in this._storedEntryBook) {
          knownHoldingList = this._storedEntryBook[bucketId]
        }
        // Update my book-keeping on what this agent has.
        for (const entryAddress of data.entryAddressList) {
          if (knownHoldingList.includes(entryAddress)) {
            continue
          }
          this._bookkeepAddressWithBucket(this._storedEntryBook, bucketId, entryAddress)
        }
        return

      case 'handleGetPublishingMetaListResult':
        // Note: data is MetaListData
        // Mark my request as resolved and get bucketId from request
        bucketId = this._checkRequest(data._id)
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
        for (const metaTuple of data.metaList) {
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
            dnaAddress: data.dnaAddress,
            _id: this._createRequestWithBucket(bucketId),
            requesterAgentId: '',
            entryAddress: metaTuple[0],
            attribute: metaTuple[1]
          }
          this._ipcSendOne(senderId, 'json', fetchMeta)
        }
        return

      case 'handleGetHoldingMetaListResult':
        // Note: data is MetaListData
        // Mark my request as resolved and get bucketId from request
        bucketId = this._checkRequest(data._id)
        if (bucketId === '') {
          return
        }
        // get already known publishing list
        let knownHoldingMetaList = []
        if (bucketId in this._storedMetaBook) {
          knownHoldingMetaList = this._storedMetaBook[bucketId]
        }
        // Update my book-keeping on what this agent has.
        for (const metaTuple of data.metaList) {
          let metaId = this._intoMetaId(metaTuple[0], metaTuple[1], metaTuple[2])
          if (knownHoldingMetaList.includes(metaId)) {
            continue
          }
          this._bookkeepAddressWithBucket(this._storedMetaBook, bucketId, metaId)
        }
        return
    }

    throw new Error('unexpected input ' + JSON.stringify(data))
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
          // Tell everyone to store
          this._ipcSend('json', {
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
          // Tell everyone to store
          this._ipcSend('json', {
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
        agentToPeerAddress: mem.registerIndexer((store, hash, data) => {
          if (data && data.type === 'agent') {
            // log.t('got Peer/Agent', data)
            store[data.agentId] = data.peerAddress
            // Tell everyone
            this._ipcSend('json', {
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
   *  Check if agent is tracking dna.
   *  If not, will try to send a FailureResult back to sender (if sender info is provided).
   *  Returns peerAddress of receiverAgentId if agent is tracking dna.
   *  @private
   */
  _getPeerAddressOrFail (dnaAddress, receiverAgentId, senderAgentId, requestId) {
    // get memory slice
    let ref = this._getMemRef(dnaAddress)
    // Check if receiver is known
    if (ref.agentToPeerAddress[receiverAgentId]) {
      log.t('oooo CHECK OK for (agent)"' + receiverAgentId + '" + (DNA) "' + dnaAddress + '" = ' + ref.agentToPeerAddress[receiverAgentId])
      return ref.agentToPeerAddress[receiverAgentId]
    }

    // Send FailureResult back to IPC, should be senderAgentId
    log.e('#### CHECK FAILED for (agent) "' + receiverAgentId + '" + (DNA) "' + dnaAddress + '" (sender: ' + senderAgentId + ')')
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

  /**
   *
   */
  _untrack (dnaAddress, agentId) {
    log.t('_untrack() for "' + agentId + '" for DNA "' + dnaAddress + '"')
    this._ipcRemoveTrack(agentId, dnaAddress)
  }

  /**
   *
   */
  _track (dnaAddress, agentId, senderId) {
    log.t('_track:', dnaAddress, agentId, senderId)
    // Bookkeep tracking
    this._ipcAddTrack(agentId, dnaAddress)
    // get mem slice
    const ref = this._getMemRef(dnaAddress)
    // create data entry
    const agent = {
      type: 'agent',
      dnaAddress: dnaAddress,
      agentId: agentId,
      peerAddress: senderId
    }

    // store agent (this will map agentId to peerAddress)
    ref.mem.insert(agent)

    // send all 'get list' requests
    let requestId = this._createRequest(dnaAddress, agentId)
    this._ipcSendOne(senderId, 'json', {
      method: 'handleGetPublishingEntryList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipcSendOne(senderId, 'json', {
      method: 'handleGetHoldingEntryList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipcSendOne(senderId, 'json', {
      method: 'handleGetPublishingMetaList',
      dnaAddress,
      _id: requestId
    })
    requestId = this._createRequest(dnaAddress, agentId)
    this._ipcSendOne(senderId, 'json', {
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
  _intoMetaId (entryAddress, attribute, metaContentJson) {
    const metaContent = JSON.stringify(metaContentJson)
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
