const https = require('https')
const { URL } = require('url')

const Wss = require('ws')

const { AsyncClass } = require('@holochain/n3h-common')
const { WssServer } = require('./wss-server')

const agent = new https.Agent({
  rejectUnauthorized: false
})

/**
 */
class ConnectionBackendWss extends AsyncClass {
  /**
   */
  async init (spec, initOptions) {
    await super.init()

    this._spec = spec

    this._servers = []
    this._cons = new Map()

    this._pingTimer = setInterval(async () => {
      for (let [id, ws] of this._cons) {
        if (Date.now() - ws._$_lastMsg > 500) {
          ws.close(1001, 'stale connection')
          await this._handleClose(id)
        } else if (Date.now() - ws._$_lastMsg >= 200) {
          ws.ping()
        }
      }
    }, 200)

    this.$pushDestructor(async () => {
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
      passphrase: 'hello',
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
      this._spec.$registerCon(id, 'remote-wss://' + req.connection.remoteAddress + ':' + req.connection.remotePort)
      await this._spec.$emitConnection(id)
    })

    srv.on('error', e => {
      if (this.$isDestroyed()) {
        return
      }
      console.error(e)
    })

    console.log('listening at ' + srv.address())

    this._servers.push(srv)
    await this._spec.$emitBind([srv.address()])
  }

  /**
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

    this._spec.$registerCon(id, conSpec)
    this._cons.set(id, ws)

    await this._spec.$emitConnect(id)
  }

  /**
   */
  async send (id, buf) {
    if (this.$isDestroyed()) {
      return
    }

    if (!this._cons.has(id)) {
      throw new Error('unknown connection id: ' + id)
    }
    const ws = this._cons.get(id)
    ws.send(buf)
  }

  /**
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

  _wsHandlers (id, ws) {
    const lastMsg = () => {
      ws._$_lastMsg = Date.now()
    }

    ws.on('error', async e => {
      if (this.$isDestroyed()) {
        return
      }

      await this._spec.$emitConError(id, e)
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

      await this._spec.$emitMessage(id, msg)
    })

    ws.on('ping', buf => {
      lastMsg()
    })

    ws.on('pong', buf => {
      lastMsg()
    })
  }

  async _handleClose (id) {
    if (this._cons.has(id)) {
      this._cons.delete(id)
    }

    if (this._spec.has(id)) {
      await this._spec.$emitClose(id)
      this._spec.$removeCon(id)
    }
  }
}

exports.ConnectionBackendWss = ConnectionBackendWss
