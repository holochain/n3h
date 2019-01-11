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

    this.$pushDestructor(async () => {
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

    const port = parseInt(parsed.port)
    if (port < 1000) {
      throw new Error('invalid port, please specify >= 1000')
    }

    const host = parsed.hostname
    const path = parsed.pathname

    const srv = await new WssServer({
      passphrase: 'hello'
    })

    srv.on('connection', async (ws, req) => {
      if (this.$isDestroyed()) {
        return
      }

      const id = 'wss:in:' + this.$createUid()

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
        await this._spec.$emitConError(new Error('connection closed (' + code + ', ' + reason + ')'))
        await this._spec.$emitClose(id)
      })

      ws.on('message', async msg => {
        if (this.$isDestroyed()) {
          return
        }
        await this._spec.$emitMessage(id, msg)
      })

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
    await this._spec.$emitBind(srv.address())
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

          await this._spec.$emitConError(new Error('connection closed (' + code + ', ' + reason + ')'))
          await this._spec.$emitClose(id)
        })

        ws.on('message', async msg => {
          if (this.$isDestroyed()) {
            return
          }

          await this._spec.$emitMessage(id, msg)
        })

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

    await this._spec.$emitClose(id)

    this._spec.$removeCon(id)
    this._cons.delete(id)
  }
}

exports.ConnectionBackendWss = ConnectionBackendWss
