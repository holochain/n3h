const { AsyncClass, createEventSpec, type } = require('@holochain/n3h-common')

const DhtEvent = createEventSpec({
  /**
   * we have received a gossip bundle from a remote node,
   * pass it along to the dht backend for processing
   */
  remoteGossipBundle: (fromPeerAddress, bundle) => {
    type.assert.base64String(fromPeerAddress)
    type.assert.base64String(bundle)
    return { fromPeerAddress, bundle }
  },

  /**
   * Instructs implementors to send this binary gossip bundle
   * to the specified list of peerIds in a reliable manner.
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
    type.assert.number(peerTs) // utc milliseconds timestamp for crdt
    return { peerAddress, peerTransport, peerData, peerTs }
  },

  /**
   * Tell implementors that gossip is requesting we hold a
   * data item. Note that this dht tracker has not actually marked this item
   * for holding until the implementors pass this event back in.
   */
  dataHoldRequest: (dataAddress, data) => {
    type.assert.base64String(dataAddress)
    type.assert.base64String(data)
    return { dataAddress, data }
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
  dataFetchResponse: (msgId, data) => {
    type.assert.string(msgId)
    type.assert.base64String(data)
    return { msgId, data }
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
