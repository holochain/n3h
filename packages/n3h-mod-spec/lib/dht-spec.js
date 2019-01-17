const { AsyncClass, createEventSpec } = require('@holochain/n3h-common')

const DhtEvent = createEventSpec({
  /**
   * we have received a gossip bundle from a remote node,
   * pass it along to the dht backend for processing
   */
  remoteGossipBundle: (bundle) => {
    // assertBase64String(bundle)
    return { bundle }
  },

  /**
   * Instructs implementors to send this binary gossip bundle
   * to the specified list of peerIds in a reliable manner.
   */
  gossipTo: (peerList, bundle) => {
    // assertBase64StringArray(peerList)
    // assertBase64String(bundle)
    return { peerList, bundle }
  },

  /**
   * Instructs implementors to send this binary gossip bundle
   * to as many peers listed in peerList as possible.
   * It is okay if not all peers on the list receive the message.
   */
  unreliableGossipTo: (peerList, bundle) => {
    // assertStringArray(peerList)
    // assertBase64String(bundle)
    return { peerList, bundle }
  },

  /**
   * Tell implementors that gossip is requesting we hold a peer discovery
   * data item. Note that this dht tracker has not actually marked this item
   * for holding until the implementors pass this event back in.
   */
  peerHoldRequest: (peerAddress, peerTransport, peerData, peerTs) => {
    // assertBase64String(peerAddress) // determines neighborhood
    // assertString(peerTransport) // uri transport connection info for peer
    // assertBase64String(peerData) // implementor supplied peer meta data
    // assertNumber(peerTs) // utc milliseconds timestamp for crdt
    return { peerAddress, peerTransport, peerData, peerTs }
  },

  /**
   * Tell implementors that gossip is requesting we hold a
   * data item. Note that this dht tracker has not actually marked this item
   * for holding until the implementors pass this event back in.
   */
  dataHoldRequest: (dataAddress, data) => {
    // assertBase64String(dataAddress) // determines neighborhood
    // assertBase64String(data) // implementor supplied data to gossip
    return { dataAddress, data }
  },

  /**
   * This dht tracker requires access to the data associated with a data hash.
   * This event should cause implementors to respond with a dataFetchResponse
   * event.
   */
  dataFetch: (msgId, dataAddress) => {
    // assertString(msgId)
    // assertBase64String(dataAddress)
    return { msgId, dataAddress }
  },

  /**
   * Response to a dataFetch event. Set `data` to `null` to indicate the
   * requested data is not available (it will be removed from gossip).
   */
  dataFetchResponse: (msgId, data) => {
    // assertString(msgId)
    // assertBase64String(data)
    return { msgId, data }
  },

  /**
   * Tell our implementors that we are no longer tracking this data
   * locally. Implementors should purge this hash from storage,
   * but that can, of course, choose not to.
   */
  dataPrune: (dataAddress) => {
    // assertBase64String(dataAddress)
    return { dataAddress }
  }
})

/**
 */
class Dht extends AsyncClass {
  /**
   */
  async init (Backend, initOptions) {
    await super.init()

    this._backend = await new Backend(this, initOptions)

    this.$pushDestructor(async () => {
      await this._backend.destroy()
      this._backend = null
    })
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

    return this._backend.getPeerLocal(peerAddress)
  }

  /**
   */
  async fetchDataLocal (dataAddress) {
    this.$checkDestroyed()

    return this._backend.fetchDataLocal(dataAddress)
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
