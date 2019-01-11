const { AsyncClass } = require('@holochain/n3h-common')

/**
 * emits:
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
   */
  async bind (bindSpec) {
    this.$checkDestroyed()
    return this._backend.bind(bindSpec)
  }

  /**
   */
  async connect (conSpec) {
    this.$checkDestroyed()
    return this._backend.connect(conSpec)
  }

  /**
   */
  async send (id, buf) {
    this.$checkDestroyed()
    return this._backend.send(id, buf)
  }

  /**
   */
  async close (id) {
    this.$checkDestroyed()
    return this._backend.close(id)
  }

  /**
   */
  async keys () {
    this.$checkDestroyed()
    return Array.from(this._cons.keys())
  }

  /**
   */
  async get (id) {
    this.$checkDestroyed()
    return this.$getCon(id)
  }

  /**
   */
  async setMeta (id, obj) {
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
   */
  $emitError (e) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('error', e)
  }

  /**
   */
  $emitConError (id, e) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('conError', this.$getCon(id), e)
  }

  /**
   */
  $emitBind (bindSpec) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('bind', bindSpec)
  }

  /**
   */
  $emitConnect (id) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('connect', this.$getCon(id))
  }

  /**
   */
  $emitConnection (id) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('connection', this.$getCon(id))
  }

  /**
   */
  $emitMessage (id, buffer) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('message', this.$getCon(id), buffer)
  }

  /**
   */
  $emitClose (id) {
    if (this.$isDestroyed()) {
      return
    }

    return this.emit('close', this.$getCon(id))
  }

  /**
   */
  $getCon (id) {
    this.$checkDestroyed()

    if (!this._cons.has(id)) {
      throw new Error('invalid id: ' + id)
    }
    return JSON.parse(this._cons.get(id))
  }

  /**
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
   */
  $removeCon (id) {
    if (this.$isDestroyed()) {
      return
    }

    this._cons.delete(id)
  }
}

exports.Connection = Connection
