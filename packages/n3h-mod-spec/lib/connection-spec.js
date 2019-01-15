const { AsyncClass } = require('@holochain/n3h-common')
const { URL } = require('url')

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
   * send data to a remote node, specified by `id`
   * send framing should be handled by the backend.
   * messages should arrive whole on the remote end.
   *
   * @param {string} id - the connection identifier to send to
   * @param {Buffer} buf - the binary data to transmit
   */
  async send (id, buf) {
    this.$checkDestroyed()
    return this._backend.send(id, buf)
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
   * protected helper function allowing backends to emit 'error' events
   */
  $emitError (e) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('error', e)
  }

  /**
   * protected helper function allowing backends to emit 'conError' events
   */
  $emitConError (id, e) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('conError', this.$getCon(id), e)
  }

  /**
   * protected helper function allowing backends to emit 'bind' events
   */
  $emitBind (bindSpec) {
    if (this.$isDestroyed()) {
      return
    }

    let good = false
    if (Array.isArray(bindSpec)) {
      good = true
      for (let spec of bindSpec) {
        if (typeof spec !== 'string') {
          good = false
          break
        }
        // throw if parse error
        new URL(spec) // eslint-disable-line no-new
      }
    }

    if (!good) {
      throw new Error('bindSpec must be an array of uri strings')
    }

    return this.emit('bind', bindSpec)
  }

  /**
   * protected helper function allowing backends to emit 'connect' events
   */
  $emitConnect (id) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('connect', this.$getCon(id))
  }

  /**
   * protected helper function allowing backends to emit 'connection' events
   */
  $emitConnection (id) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('connection', this.$getCon(id))
  }

  /**
   * protected helper function allowing backends to emit 'message' events
   */
  $emitMessage (id, buffer) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('message', this.$getCon(id), buffer)
  }

  /**
   * protected helper function allowing backends to emit 'close' events
   */
  $emitClose (id) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('close', this.$getCon(id))
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

exports.Connection = Connection
