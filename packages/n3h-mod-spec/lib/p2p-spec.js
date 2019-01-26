const {
  AsyncClass,
  Track,
  createEventSpec,
  type
} = require('@holochain/n3h-common')

const P2pEvent = createEventSpec({
  /**
   */
  message: (fromPeerAddress, msgId, data) => {
    type.assert.base64String(fromPeerAddress)
    type.assert.string(msgId)
    type.assert.base64String(data)
    return { fromPeerAddress, msgId, data }
  }
})

/**
 */
class P2p extends AsyncClass {
  /**
   * async constructor
   * @param {class} Backend - the backend to use
   * @param {object} initOptions - backend specific initialization options
   */
  async init (Backend, initOptions) {
    await super.init()

    this._requestTrack = await new Track()
    this._backend = await new Backend(this, initOptions)
    this._cons = new Map()

    this.$pushDestructor(async () => {
      await this._requestTrack.destroy()
      await this._backend.destroy()
      this._backend = null
      this._cons = null
    })
  }

  /**
   */
  getId () {
    if (this.$isDestroyed()) {
      return
    }

    return this._backend.getId()
  }

  /**
   */
  getAdvertise () {
    if (this.$isDestroyed()) {
      return
    }

    return this._backend.getAdvertise()
  }

  /**
   */
  async transportConnect (url) {
    if (this.$isDestroyed()) {
      return
    }

    type.assert.url(url)

    return this._backend.transportConnect(url)
  }

  /**
   */
  async publishReliable (peerAddressList, data) {
    if (this.$isDestroyed()) {
      return
    }

    type.assert.arrayOf.base64String(peerAddressList)
    type.assert.base64String(data)

    return this._backend.publishReliable(peerAddressList, data)
  }

  /**
   */
  async publishUnreliable (peerAddressList, data) {
    if (this.$isDestroyed()) {
      return
    }

    type.assert.arrayOf.base64String(peerAddressList)
    type.assert.base64String(data)

    return this._backend.publishUnreliable(peerAddressList, data)
  }

  /**
   */
  async requestReliable (peerAddressList, data) {
    if (this.$isDestroyed()) {
      return
    }

    type.assert.arrayOf.base64String(peerAddressList)
    type.assert.base64String(data)

    const msgId = this.$createUid()
    await this._backend.requestReliable(msgId, peerAddressList, data)
    return this._requestTrack.track(msgId)
  }

  // -- protected -- //

  /**
   * protected helper function for emitting connection events
   */
  $emitEvent (evt) {
    if (this.$isDestroyed()) {
      return
    }

    if (!P2pEvent.isEvent(evt)) {
      throw new Error('can only emit P2pEvent instances')
    }

    return this.emit('event', evt)
  }

  /**
   */
  $checkMsgIdResponse (evt) {
    if (this.$isDestroyed()) {
      return
    }

    if (!P2pEvent.isEvent(evt) || evt.type !== 'message') {
      throw new Error('can only check P2pEvent.message instances')
    }

    this._requestTrack.resolve(evt.msgId, evt)
  }
}

P2p.P2pEvent = exports.P2pEvent = P2pEvent

exports.P2p = P2p
