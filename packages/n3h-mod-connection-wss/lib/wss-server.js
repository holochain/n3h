const forge = require('node-forge')
const express = require('express')
const expressWs = require('express-ws')
const helmet = require('helmet')

const fs = require('fs')
const os = require('os')
const https = require('https')

const { AsyncClass } = require('@holochain/n3h-common')

/**
 * Generate a new self-signed tls certificate, and encrypted
 * private key, both pem encoded.
 *
 * (persist them to "tlsFile")
 */
async function genCert (passphrase, rsaBits, tlsFile) {
  const keys = forge.pki.rsa.generateKeyPair(rsaBits)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notBefore.setFullYear(cert.validity.notBefore.getFullYear() - 1)
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 5)
  const attrs = [
    ['CN', 'holo.host'],
    ['C', 'GI'],
    ['O', 'holo'],
    ['OU', 'holochain']
  ].map(([n, v]) => ({ shortName: n, value: v }))
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey)
  const crt = forge.pki.certificateToPem(cert)
  const key = forge.pki.encryptRsaPrivateKey(keys.privateKey, passphrase)

  fs.writeFileSync(tlsFile, JSON.stringify({
    crt,
    key
  }, null, 2))

  return { crt, key }
}

/**
 * Given an encrypted pem encoded tls private key,
 * return an unencrypted pem encoded tls private key.
 */
async function decryptKey (key, passphrase) {
  const privateKey = forge.pki.decryptRsaPrivateKey(key, passphrase)
  const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e)
  const finger = Buffer.from(forge.pki.getPublicKeyFingerprint(publicKey, {
    encoding: 'hex'
  }), 'hex').toString('base64')
  return {
    privateKey: forge.pki.privateKeyToPem(privateKey),
    finger
  }
}

/**
 * load a cert and privateKey from "tlsFile", or generate new, saving them.
 */
async function getCert (passphrase, rsaBits, tlsFile) {
  let crt = null
  let key = null

  if (fs.existsSync(tlsFile)) {
    ;({ crt, key } = JSON.parse(fs.readFileSync(tlsFile)))
  } else {
    console.log('warning: no tls data found, generating new keys and cert')
    ;({ crt, key } = await genCert(
      passphrase, rsaBits, tlsFile))
  }

  const { privateKey, finger } = await decryptKey(key, passphrase)

  console.log('loaded rsa fingerprint', finger)

  return {
    crt,
    privateKey
  }
}

/**
 * Begin listening to a port / servicing it as a tls secured WebSocketServer.
 *
 * @param {object} options
 * @param {string} options.passphrase - passphrase for decrypting privateKey
 * @param {number} [options.port] - default 8443
 * @param {string} [options.host] - default '0.0.0.0'
 * @param {string} [options.path] - default '/'
 * @param {number} [options.rsaBits] - how strong is the tls cert private key?
 *                                   - default 4096
 * @param {string} [options.tlsFile] - where to store the private key / cert
 *                                   - default './tls-data.json'
 */
class WssServer extends AsyncClass {
  /**
   * `const srv = await new WssServer({passphrase: 'test'})`
   */
  async init (options) {
    await super.init()

    if (!options || typeof options !== 'object') {
      throw new Error('options required')
    }

    if (typeof options.passphrase !== 'string' || !options.passphrase.length) {
      throw new Error('options.passphrase required')
    }

    const passphrase = options.passphrase
    const port = typeof options.port === 'number' ? options.port : 8443
    const host = options.host || '0.0.0.0'
    const path = this._path = options.path || '/'
    const rsaBits = options.rsaBits || 4096
    const tlsFile = options.tlsFile || 'tls-data.json'

    const { crt, privateKey } = await getCert(
      passphrase, rsaBits, tlsFile)

    const app = this._app = express()

    const srv = this._srv = https.createServer({
      key: privateKey,
      cert: crt
    }, app)

    const wss = expressWs(app, srv, {
      wsOptions: {
        perMessageDeflate: false
      }
    })

    app.disable('x-powered-by')
    app.use(helmet({
      noCache: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: true
        }
      },
      referrerPolicy: true
    }))
    app.use(helmet.noCache())
    app.enable('trust proxy')

    app.ws(path, (ws, req) => {
      this.emit('connection', ws, req)
    })

    srv.on('clientError', e => {
      this.emit('error', e)
    })

    this.$pushDestructor(async () => {
      const timeoutStack = (new Error('timeout')).stack
      await Promise.all([
        new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(timeoutStack))
          })
          srv.close(() => {
            clearTimeout(timeoutId)
            resolve()
          })
        }),
        new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(timeoutStack))
          })
          wss.getWss().close(() => {
            clearTimeout(timeoutId)
            resolve()
          })
        })
      ])

      this._srv = null
      this._app = null
      this._path = null
      this._address = null
    })

    await new Promise((resolve, reject) => {
      try {
        srv.listen(port, host, async () => {
          await this._calcAddress()
          resolve()
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  /**
   * get the address this websocket server was bound to
   * (note, in the case of 0.0.0.0, this is just picking the first non loopback)
   */
  address () {
    return this._address
  }

  // -- private -- //

  /**
   * if node tells us we are bound to 0.0.0.0, try to find a real interface
   * ... we need people to be able to connect to us here.
   */
  async _calcAddress () {
    const addr = this._srv.address()
    let address = addr.address
    if (address === '0.0.0.0') {
      const ilist = os.networkInterfaces()
      for (let iname in ilist) {
        for (let iface of ilist[iname]) {
          if (iface.family === 'IPv4' && iface.address !== '127.0.0.1') {
            address = iface.address
          }
        }
      }
    }
    this._address = `wss://${address}:${addr.port}${this._path}`
  }
}

exports.WssServer = WssServer
