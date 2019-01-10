const forge = require('node-forge')
const express = require('express')
const expressWs = require('express-ws')
const helmet = require('helmet')

const fs = require('fs')
const https = require('https')

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

exports.getCert = async (passphrase, options) => {
  let crt = null
  let key = null

  if (fs.existsSync(options.tlsFile)) {
    ;({ crt, key } = JSON.parse(fs.readFileSync(options.tlsFile)))
  } else {
    console.log('warning: no tls data found, generating new keys and cert')
    ;({ crt, key } = await genCert(
      passphrase, options.rsaBits, options.tlsFile))
  }

  const { privateKey, finger } = await decryptKey(key, passphrase)

  console.log('loaded rsa fingerprint', finger)

  return {
    crt,
    privateKey
  }
}

exports.createServer = async function createServer (passphrase, options) {
  if (typeof passphrase !== 'string' || !passphrase.length) {
    throw new Error('passphrase required')
  }
  options || (options = {})
  options.port || (options.port = 8443)
  options.rsaBits || (options.rsaBits = 4096)
  options.tlsFile || (options.tlsFile = 'tls-data.json')

  const { crt, privateKey } = await exports.getCert(passphrase, options)

  const app = express()
  const srv = https.createServer({
    key: privateKey,
    cert: crt
  }, app)

  const ws = expressWs(app, srv, {
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

  app.post('/', async (req, res) => {
    const body = await new Promise((resolve, reject) => {
      try {
        let body = Buffer.alloc(0)
        req.on('data', chunk => {
          try {
            body = Buffer.concat([body, chunk])
          } catch (e) {
            reject(e)
          }
        })
        req.on('end', () => {
          resolve(body)
        })
      } catch (e) {
        reject(e)
      }
    })
    const now = Date.now()
    res.json({
      now,
      str: (new Date(now)).toISOString(),
      postData: body.toString()
    })
  })

  app.ws('/', (ws, req) => {
    console.log(req.ips, req.ip,
      req.connection.remoteAddress,
      req.connection.remoteFamily,
      req.connection.remotePort,
      req.connection.localAddress,
      req.connection.localPort
    )
    ws.on('message', (msg) => {
      ws.send('echo: ' + msg)
    })
  })

  srv.closeOrig = srv.close
  srv.close = () => {
    const timeoutStack = (new Error('timeout')).stack
    return Promise.all([
      new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(timeoutStack))
        })
        srv.closeOrig(() => {
          clearTimeout(timeoutId)
          resolve()
        })
      }),
      new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(timeoutStack))
        })
        ws.getWss().close(() => {
          clearTimeout(timeoutId)
          resolve()
        })
      })
    ])
  }

  srv.on('clientError', e => {
    console.error('clientError', e)
  })

  return new Promise((resolve, reject) => {
    try {
      srv.listen(options.port, () => {
        console.log('listening on port', options.port)
        resolve(srv)
      })
    } catch (e) {
      reject(e)
    }
  })
}
