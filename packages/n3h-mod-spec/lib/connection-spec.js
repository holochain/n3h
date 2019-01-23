const { AsyncClass, createEventSpec, type } = require('@holochain/n3h-common')

const ConnectionEvent = createEventSpec({
  /**
   */
  error: (error) => {
    type.assert.string(error)
    return { error }
  },

  /**
   */
  conError: (id, error) => {
    type.assert.string(id)
    type.assert.string(error)
    return { id, error }
  },

  /**
   */
  bind: (boundUriList) => {
    type.assert.arrayOf.url(boundUriList)
    return { boundUriList }
  },

  /**
   */
  connect: (id) => {
    type.assert.string(id)
    return { id }
  },

  /**
   */
  connection: (id) => {
    type.assert.string(id)
    return { id }
  },

  /**
   */
  message: (id, buffer) => {
    type.assert.string(id)
    type.assert.base64String(buffer)
    return { id, buffer }
  },

  /**
   */
  close: (id, data) => {
    type.assert.string(id)
    type.assert.object(data)
    return { id, data }
  }
})

/**
 * A connection is not transport specific,
 * but let us use TCP as a concrete example.
 *
 * A TCP module that follows this "Connection" spec would be both a server
 * and a client. It would be able to bind to multiple network interfaces
 * and ports, as well as connect to multiple remote tcp listeners.
 *
 * It manages connections through "ID"s that are unique at least to this
 * javascript execution process.
 *
 * It allows you to store JSON-ifyable immutable data along with these "ID"s.
 *
 * Create a "Connection" spec instance by passing it a concrete implementation
 *
 *    `const con = await new Connection(ConnectionBackendTcp, {})`
 *
 * Emits the following events:
 *  - error - some kind of asynchronous failure
 *  - conError - an error with a particular connection
 *  - bind - we were bound
 *  - connect - we have connected
 *  - connection - incoming connection
 *  - message - a frame from a remote
 *  - close - a connection has closed
 */
class Connection extends AsyncClass {
  /**
   * async constructor
   * @param {class} Backend - the backend to use
   * @param {object} initOptions - backend specific initialization options
   */
  async init (Backend, initOptions) {
    await super.init()

    this._backend = await new Backend(this, initOptions)
    this._cons = new Map()

    this.$pushDestructor(async () => {
      await this._backend.destroy()
      this._backend = null
      this._cons = null
    })
  }

  /**
   * Do anything necessary to set up a server / start listening
   * @param {string} [bindSpec] - if specified, should be a uri
   */
  async bind (bindSpec) {
    this.$checkDestroyed()
    return this._backend.bind(bindSpec)
  }

  /**
   * Do anything necessary to establisg a connection to a remote server
   * @param {string} [conSpec] - if specified, should be a uri
   */
  async connect (conSpec) {
    this.$checkDestroyed()
    return this._backend.connect(conSpec)
  }

  /**
   * send data to remote nodes, specified in `idList`
   * send framing should be handled by the backend.
   * messages should arrive whole on the remote end.
   *
   * @param {array<string>} idList - the connection identifiers to send to
   * @param {base64string} buf - the binary data to transmit
   */
  async send (idList, buf) {
    this.$checkDestroyed()
    return this._backend.send(idList, buf)
  }

  /**
   * send data to remote nodes, specified in `idList`
   * send framing should be handled by the backend.
   * messages should arrive whole on the remote end.
   * It is okay if this data does not reach its target
   *
   * @param {array<string>} idList - the connection identifiers to send to
   * @param {base64string} buf - the binary data to transmit
   */
  async sendUnreliable (idList, buf) {
    this.$checkDestroyed()
    return this._backend.sendUnreliable(idList, buf)
  }

  /**
   * close a connection to a specific remote node, specified by `id`
   *
   * @param {string} id - the connection identifier to close
   */
  async close (id) {
    this.$checkDestroyed()
    return this._backend.close(id)
  }

  /**
   * list all open connection `id`s (identifiers)
   *
   * @return {iterator}
   */
  keys () {
    this.$checkDestroyed()
    return this._cons.keys()
  }

  /**
   * is there an open connection identified by `id`?
   *
   * @return {boolean}
   */
  has (id) {
    if (this.$isDestroyed()) {
      return false
    }
    return this._cons.has(id)
  }

  /**
   * return all metadata associated with `id`
   *
   * @param {string} id - the connection identifier to fetch
   *
   * @return {object} connection metadata
   */
  get (id) {
    this.$checkDestroyed()
    return this.$getCon(id)
  }

  /**
   * append additional metadata items to the connection metadata
   * events that are published with this connection will contain this new data
   *
   * @param {string} id - the connection identifier to augment
   * @param {object} obj - all key/value pairs in obj will be appended
   */
  setMeta (id, obj) {
    if (this.$isDestroyed()) {
      return
    }

    const con = this.$getCon(id)

    for (let n in obj) {
      if (n === 'spec' || n === 'id') {
        throw new Error('cannot overwrite id or spec')
      }
      con[n] = obj[n]
    }

    this._cons.set(id, JSON.stringify(con))
  }

  // -- protected -- //

  /**
   * protected helper function for emitting connection events
   */
  $emitEvent (evt) {
    if (this.$isDestroyed()) {
      return
    }

    if (!ConnectionEvent.isEvent(evt)) {
      throw new Error('can only emit ConnectionEvent instances')
    }

    return this.emit('event', evt)
  }

  /**
   * protected helper function allowing backends to fetch connection metadata
   */
  $getCon (id) {
    this.$checkDestroyed()

    if (!this._cons.has(id)) {
      throw new Error('invalid id: ' + id)
    }
    return JSON.parse(this._cons.get(id))
  }

  /**
   * protected helper function allowing backends to register new connections
   */
  $registerCon (id, spec) {
    if (this.$isDestroyed()) {
      return
    }

    this._cons.set(id, JSON.stringify({
      id,
      spec
    }))
    return this.$getCon(id)
  }

  /**
   * protected helper function allowing backends to unregister closed connections
   */
  $removeCon (id) {
    if (this.$isDestroyed()) {
      return
    }

    this._cons.delete(id)
  }
}

Connection.ConnectionEvent = exports.ConnectionEvent = ConnectionEvent

exports.Connection = Connection
