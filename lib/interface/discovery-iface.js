const {
  AsyncClass,
  createEventSpec,
  type
} = require('../n3h-common')

const DiscoveryEvent = createEventSpec({
  /**
   * we found a viable bootstrap peer
   */
  discovery: (uriList) => {
    type.assert.arrayOf.url(uriList)
    return { uriList }
  }
})

/**
 * Interface for method of auto-discovering bootstrap peers
 */
class Discovery extends AsyncClass {
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

  // -- protected -- //

  /**
   * protected helper function for emitting connection events
   */
  async $emitEvent (evt) {
    if (this.$isDestroyed()) {
      return
    }

    if (!DiscoveryEvent.isEvent(evt)) {
      throw new Error('can only emit DiscoveryEvent instances')
    }

    return this.emit('event', evt)
  }
}

Discovery.DiscoveryEvent = exports.DiscoveryEvent = DiscoveryEvent

exports.Discovery = Discovery
