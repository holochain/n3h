const https = require('https')
const { URL } = require('url')

const Wss = require('ws')

const { AsyncClass } = require('../n3h-common')
const { WssServer } = require('./wss-server')
const { ConnectionEvent, Connection } = require('../interface')

const tweetlog = require('../tweetlog')
const log = tweetlog('wss-connection')

const agent = new https.Agent({
  rejectUnauthorized: false
})

/**

 * A Tls Secure WebSocketServer Backend for the n3h mod "Connection" spec
 *
 * ```
 * const con = await new Connection(ConnectionBackendWss, {
 *   passphrase: 'test-passphrase',
 *   rsaBits: 4096
 * })
 * ```
 */
class ConnectionBackendWss extends AsyncClass {
  /**
   * async constructor
   */
  async init (initOptions) {
    await super.init()

    if (!initOptions || typeof initOptions !== 'object') {
      throw new Error('initOptions must be an object')
    }

    if (typeof initOptions.passphrase !== 'string' || !initOptions.passphrase.length) {
      throw new Error('passphrase must be specified')
    }

    this._rsaBits = initOptions.rsaBits
    this._tlsFile = initOptions.tlsFile
    this._passphrase = initOptions.passphrase

    this.connectionInterface = this._iface = await new Connection(this)

    this._servers = []
    this._cons = new Map()

    this._pingTimer = setInterval(async () => {
      for (let [id, ws] of this._cons) {
        if (Date.now() - ws._$_lastMsg > 5000) {
          ws.close(1001, 'stale connection')
          await this._handleClose(id)
        } else if (Date.now() - ws._$_lastMsg >= 2000) {
          ws.ping()
        }
      }
    }, 200)

    this.$pushDestructor(async () => {
      await this._iface.destroy()
      this.connectionInterface = null
      this._iface = null

      clearInterval(this._pingTimer)
      this._pingTimer = null

      let wait = null

      for (let con of this._cons.values()) {
        con.close(1000)
      }
      this._cons = null

      wait = []
      for (let srv of this._servers) {
        wait.push(srv.destroy())
      }
      await Promise.all(wait)
      this._servers = null
    })
  }

  /**
   * bind to network interface
   * @param {string} bindSpec - should be a uri with protocol `wss:`
   */
  async bind (bindSpec) {
    const parsed = new URL(bindSpec)

    if (parsed.protocol !== 'wss:') {
      throw new Error('unimplemented protocol: (' + parsed.protocol + ') use wss:')
    }

    const port = parseInt(parsed.port, 10)
    if (port !== 0 && port < 1000) {
      throw new Error('invalid port, please specify 0 or >= 1000')
    }

    const host = parsed.hostname
    const path = parsed.pathname

    const srv = await new WssServer({
      passphrase: this._passphrase,
      rsaBits: this._rsaBits,
      tlsFile: this._tlsFile,
      host,
      port,
      path
    })

    srv.on('connection', async (ws, req) => {
      if (this.$isDestroyed()) {
        return
      }

      const id = 'wss:in:' + this.$createUid()

      this._wsHandlers(id, ws)

      this._cons.set(id, ws)
      this._iface.$registerCon(id, 'remote-wss://' + req.connection.remoteAddress + ':' + req.connection.remotePort)
      await this._iface.$emitEvent(ConnectionEvent.connection(id))
    })

    srv.on('error', e => {
      if (this.$isDestroyed()) {
        return
      }
      log.e(e)
    })

    log.i('listening at ' + srv.address())

    this._servers.push(srv)
    await this._iface.$emitEvent(ConnectionEvent.bind([srv.address()]))
  }

  /**
   * connect to remote websocket server
   * @param {string} conSpec - should be a uri with protocol `wss:`
   */
  async connect (conSpec) {
    const parsed = new URL(conSpec)

    if (parsed.protocol !== 'wss:') {
      throw new Error('unimplemented protocol: (' + parsed.protocol + ') use wss:')
    }

    const id = 'wss:out:' + this.$createUid()

    const ws = await new Promise((resolve, reject) => {
      try {
        const ws = new Wss(conSpec, {
          perMessageDeflate: false,
          agent
        })

        this._wsHandlers(id, ws)

        ws.on('open', () => {
          resolve(ws)
        })
      } catch (e) {
        reject(e)
      }
    })

    this._iface.$registerCon(id, conSpec)
    this._cons.set(id, ws)

    await this._iface.$emitEvent(ConnectionEvent.connect(id))
  }

  /**
   * send a message to a remote peer
   * @param {array} idList - the remote peer identifiers
   * @param {Buffer} buf - the binary data to transmit
   */
  async send (idList, buf) {
    if (this.$isDestroyed()) {
      return
    }

    for (let id of idList) {
      if (!this._cons.has(id)) {
        throw new Error('unknown connection id: ' + id)
      }
      const ws = this._cons.get(id)
      ws.send(Buffer.from(buf, 'base64'))
    }
  }

  /**
   * wss does not have an unreliable send method
   * just forward these to send
   */
  async sendUnreliable (idList, buf) {
    return this.send(idList, buf)
  }

  /**
   * close a connection to a remote peer
   * @param {string} id - the remote peer identifier
   */
  async close (id) {
    if (this.$isDestroyed()) {
      return
    }

    if (!this._cons.has(id)) {
      throw new Error('unknown connection id: ' + id)
    }
    const ws = this._cons.get(id)
    ws.close(1000)

    await this._handleClose(id)
  }

  // -- private -- //

  /**
   * helper for setting up event handling on a websocket connection
   * this connection could be a remote connecting to us
   * or it could be us connecting to a remote server.
   */
  _wsHandlers (id, ws) {
    const lastMsg = () => {
      ws._$_lastMsg = Date.now()
    }

    ws.on('error', async e => {
      if (this.$isDestroyed()) {
        return
      }

      if (e.code === 'ECONNREFUSED') {
        await this._handleClose(id)
        return
      }

      await this._iface.$emitEvent(ConnectionEvent.conError(id, e.stack || e.toString()))
    })

    ws.on('close', async (code, reason) => {
      if (this.$isDestroyed()) {
        return
      }

      await this._handleClose(id)
    })

    ws.on('message', async msg => {
      if (this.$isDestroyed()) {
        return
      }

      lastMsg()

      if (msg instanceof Buffer) {
        msg = msg.toString('base64')
      } else if (typeof msg === 'string') {
        msg = Buffer.from(msg, 'utf8').toString('base64')
      } else {
        throw new Error('bad message type: ' + typeof msg)
      }
      await this._iface.$emitEvent(ConnectionEvent.message(id, msg))
    })

    ws.on('ping', buf => {
      lastMsg()
    })

    ws.on('pong', buf => {
      lastMsg()
    })
  }

  /**
   * clean up our own internal tracking in the event of a closed connection
   */
  async _handleClose (id) {
    if (this._cons.has(id)) {
      this._cons.delete(id)
    }

    if (this._iface.has(id)) {
      const data = this._iface.get(id)
      await this._iface.$emitEvent(ConnectionEvent.close(id, data))
      this._iface.$removeCon(id)
    }
  }
}

exports.ConnectionBackendWss = ConnectionBackendWss
