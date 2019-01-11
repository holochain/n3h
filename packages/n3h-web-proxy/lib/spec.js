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
    await this.emit('bind', bindSpec)

    // simulate a remote connection
    const con = this._registerCon('in:' + this.$createUid(), '/rem/test/addr')
    await this.emit('connection', JSON.parse(JSON.stringify(con)))

    // simulate a remote message
    await this.emit('message', con, Buffer.from('test-in'))

    // simulate some kind of error
    await this.emit('error', new Error('ignore-me'))
  }

  /**
   */
  async connect (conSpec) {
    const con = this._registerCon('out:' + this.$createUid(), conSpec)
    await this.emit('connect', JSON.parse(JSON.stringify(con)))

    // simulate a remote message
    await this.emit('message', con, Buffer.from('test-out'))
  }

  /**
   */
  async send (id, buf) {
    const con = this._getCon(id)

    // simulate an echo
    await this.emit('message', con, Buffer.concat([
      Buffer.from('echo: '),
      buf
    ]))
  }

  /**
   */
  async close (id) {
    const con = this._getCon(id)

    await this.emit('close', con)
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
