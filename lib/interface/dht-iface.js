const { AsyncClass, createEventSpec, type } = require('../n3h-common')

const DhtEvent = createEventSpec({
  /**
   * we have received a gossip bundle from a remote peer,
   * pass it along to the dht backend for processing
   */
  remoteGossipBundle: (fromPeerAddress, bundle) => {
    type.assert.base64String(fromPeerAddress)
    type.assert.base64String(bundle)
    return { fromPeerAddress, bundle }
  },

  /**
   * Instructs implementors to send this binary gossip bundle
   * to the specified list of peerAddress' in a reliable manner.
   */
  gossipTo: (peerList, bundle) => {
    type.assert.arrayOf.base64String(peerList)
    type.assert.base64String(bundle)
    return { peerList, bundle }
  },

  /**
   * Instructs implementors to send this binary gossip bundle
   * to as many peers listed in peerList as possible.
   * It is okay if not all peers on the list receive the message.
   */
  unreliableGossipTo: (peerList, bundle) => {
    type.assert.arrayOf.base64String(peerList)
    type.assert.base64String(bundle)
    return { peerList, bundle }
  },

  /**
   * Tell implementors that gossip is requesting we hold a peer discovery
   * data item. Note that this dht tracker has not actually marked this item
   * for holding until the implementors pass this event back in.
   */
  peerHoldRequest: (peerAddress, peerTransport, peerData, peerTs) => {
    type.assert.base64String(peerAddress) // determines neighborhood
    type.assert.url(peerTransport) // uri transport connection info for peer
    type.assert.base64String(peerData) // implementor supplied peer meta data
    type.assert.number(peerTs) // utc milliseconds timestamp for crdt and timeouts
    return { peerAddress, peerTransport, peerData, peerTs }
  },

  /**
   * Tell implementors that gossip believes a peer has dropped
   */
  peerTimedOut: (peerAddress) => {
    type.assert.base64String(peerAddress)
    return { peerAddress }
  },

  /**
   * Tell implementors that gossip is requesting we hold a data item.
   * Note that this dht tracker has not actually marked this item
   * for holding until the implementors pass this event back in.
   */
  dataHoldRequest: (dataAddress, dataList) => {
    type.assert.base64String(dataAddress)
    type.assert.arrayOf.base64String(dataList)
    return { dataAddress, dataList }
  },

  /**
   * This dht tracker requires access to the data associated with a data hash.
   * This event should cause implementors to respond with a dataFetchResponse
   * event.
   */
  dataFetch: (msgId, dataAddress) => {
    type.assert.string(msgId)
    type.assert.base64String(dataAddress)
    return { msgId, dataAddress }
  },

  /**
   * Response to a dataFetch event. Set `data` to `null` to indicate the
   * requested data is not available (it will be removed from gossip).
   */
  dataFetchResponse: (msgId, dataList) => {
    type.assert.string(msgId)
    type.assert.arrayOf.base64String(dataList)
    return { msgId, dataList }
  },

  /**
   * Tell our implementors that we are no longer tracking this data
   * locally. Implementors should purge this hash from storage,
   * but that can, of course, choose not to.
   */
  dataPrune: (dataAddress) => {
    type.assert.base64String(dataAddress)
    return { dataAddress }
  }
})

function assertPeerHoldRequest (e) {
  if (!DhtEvent.isEvent(e) || e.type !== 'peerHoldRequest') {
    throw new Error('expected peerHoldRequest DhtEvent, got ' + JSON.stringify(e))
  }
}

/**
 */
class Dht extends AsyncClass {
  /**
   */
  async init (backend) {
    await super.init()

    this._backend = backend

    this.$pushDestructor(async () => {
      if (this._backend && !this._backend.$isDestroying()) {
        await this._backend.destroy()
      }
      this._backend = null
    })
  }

  /**
   */
  getThisPeer () {
    return this._backend.getThisPeer()
  }

  /**
   * post a DhtEvent instance to the processing loop
   */
  post (evt) {
    if (this.$isDestroyed()) {
      return
    }

    if (!DhtEvent.isEvent(evt)) {
      throw new Error('can only post DhtEvent instances')
    }

    this._backend.post(evt)
  }

  /**
   */
  getPeerLocal (peerAddress) {
    this.$checkDestroyed()

    const out = this._backend.getPeerLocal(peerAddress)

    if (out) {
      assertPeerHoldRequest(out)
    }

    return out
  }

  /**
   */
  async fetchPeer (peerAddress) {
    this.$checkDestroyed()

    const out = await this._backend.fetchPeer(peerAddress)

    if (out) {
      assertPeerHoldRequest(out)
    }

    return out
  }

  /**
   */
  async dropPeer (peerAddress) {
    this.$checkDestroyed()
    await this._backend.dropPeerLocal(peerAddress)
  }

  /**
   */
  async fetchDataLocal (dataAddress) {
    this.$checkDestroyed()

    return this._backend.fetchDataLocal(dataAddress)
  }

  /**
   */
  async fetchData (dataAddress) {
    this.$checkDestroyed()

    return this._backend.fetchData(dataAddress)
  }

  // -- protected -- //

  /**
   * protected helper function for emitting dht events
   */
  $emitEvent (evt) {
    if (this.$isDestroyed()) {
      return
    }

    if (!DhtEvent.isEvent(evt)) {
      throw new Error('can only emit DhtEvent instances')
    }

    return this.emit('event', evt)
  }
}

Dht.DhtEvent = exports.DhtEvent = DhtEvent

exports.Dht = Dht
