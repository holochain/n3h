const { AsyncClass } = require('@holochain/n3h-common')

/**
 * emits:
 *  - error - some kind of asynchronous failure
 *  - bind - we were bound
 *  - connect - we have connected
 *  - connection - incoming connection
 *  - message - a frame from a remote
 *  - close - a connection has closed
 */
class Connection extends AsyncClass {
  /**
   */
  async init () {
    await super.init()

    this._cons = new Map()
  }

  /**
   */
  async bind (bindSpec) {
    await this._emitBind(bindSpec)

    // simulate a remote connection
    const con = this._registerCon('in:' + this.$createUid(), '/rem/test/addr')
    await this._emitConnection(con.id)

    // simulate a remote message
    await this._emitMessage(con.id, Buffer.from('test-in'))

    // simulate some kind of error
    await this._emitError(new Error('ignore-me'))
  }

  /**
   */
  async connect (conSpec) {
    const con = this._registerCon('out:' + this.$createUid(), conSpec)
    await this._emitConnect(con.id)

    // simulate a remote message
    await this._emitMessage(con.id, Buffer.from('test-out'))
  }

  /**
   */
  async send (id, buf) {
    // simulate an echo
    await this._emitMessage(id, Buffer.concat([
      Buffer.from('echo: '),
      buf
    ]))
  }

  /**
   */
  async close (id) {
    await this._emitClose(id)
    this._cons.delete(id)
  }

  /**
   */
  async keys () {
    return Array.from(this._cons.keys())
  }

  /**
   */
  async get (id) {
    return this._getCon(id)
  }

  /**
   */
  async setMeta (id, obj) {
    const con = this._getCon(id)

    for (let n in obj) {
      if (n === 'spec' || n === 'id') {
        throw new Error('cannot overwrite id or spec')
      }
      con[n] = obj[n]
    }

    this._cons.set(id, JSON.stringify(con))
  }

  // -- private -- //

  /**
   */
  _emitError (e) {
    return this.emit('error', e)
  }

  /**
   */
  _emitBind (bindSpec) {
    return this.emit('bind', bindSpec)
  }

  /**
   */
  _emitConnect (id) {
    return this.emit('connect', this._getCon(id))
  }

  /**
   */
  _emitConnection (id) {
    return this.emit('connection', this._getCon(id))
  }

  /**
   */
  _emitMessage (id, buffer) {
    return this.emit('message', this._getCon(id), buffer)
  }

  /**
   */
  _emitClose (id) {
    return this.emit('close', this._getCon(id))
  }

  /**
   */
  _getCon (id) {
    if (!this._cons.has(id)) {
      throw new Error('invalid id: ' + id)
    }
    return JSON.parse(this._cons.get(id))
  }

  /**
   */
  _registerCon (id, spec) {
    id = 'mockCon:' + id
    this._cons.set(id, JSON.stringify({
      id,
      spec
    }))
    return this._getCon(id)
  }
}

exports.Connection = Connection
