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
    this._respondTrack = await new Track()
    this._backend = await new Backend(this, initOptions)
    this._cons = new Map()

    this.$pushDestructor(async () => {
      await this._requestTrack.destroy()
      await this._respondTrack.destroy()
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

  /**
   */
  async respondReliable (msgId, data) {
    return this._respondTrack.resolve(msgId, data)
  }

  // -- protected -- //

  /**
   * protected helper function for emitting connection events
   */
  async $emitEvent (evt) {
    if (this.$isDestroyed()) {
      return
    }

    if (!P2pEvent.isEvent(evt)) {
      throw new Error('can only emit P2pEvent instances')
    }

    switch (evt.type) {
      case 'message':
        const locMsgId = this.$createUid()
        this._respondTrack.track(locMsgId).then(async data => {
          return this._backend.respondReliable(
            evt.msgId, evt.fromPeerAddress, data)
        }).catch(err => {
          if (err.toString() !== 'Error: destroying') {
            console.error('Exception In Response Handler', err)
            process.exit(1)
          }
        })

        const newMessage = P2pEvent.message(
          evt.fromPeerAddress, locMsgId, evt.data)
        return this.emit('event', newMessage)
      default:
        throw new Error('invalid P2pEvent type: ' + evt.type)
    }
  }

  /**
   */
  async $checkResolveRequest (evt) {
    if (this.$isDestroyed()) {
      return
    }

    if (!P2pEvent.isEvent(evt) || evt.type !== 'message') {
      throw new Error('can only check P2pEvent.message instances')
    }

    return this._requestTrack.resolve(evt.msgId, evt.data.toString('base64'))
  }
}

P2p.P2pEvent = exports.P2pEvent = P2pEvent

exports.P2p = P2p
