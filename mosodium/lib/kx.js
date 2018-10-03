const sodium = require('sodium-native')
const { SecBuf } = require('./secbuf')

/**
 * Generate a fresh, random keyexchange keypair
 * @example
 * const { publicKey, secretKey } = mosodium.kx.keypair()
 *
 * @param {string} lockLevel - the SecBuf.LOCK_* level of output SecBuf
 * @return {object} { publicKey, secretKey }
 */
exports.keypair = function kxKeypair (lockLevel) {
  const pk = Buffer.alloc(sodium.crypto_kx_PUBLICKEYBYTES)
  const sk = new SecBuf(sodium.crypto_kx_SECRETKEYBYTES, lockLevel)

  sk.writable((_sk) => {
    sodium.crypto_kx_keypair(pk, _sk)
  })

  return {
    publicKey: pk,
    secretKey: sk
  }
}

/**
 * Given a server's public key, derive shared secrets.
 * @example
 * const { rx, tx } = mosodium.kx.clientSession(cliPub, cliSec, srvPub)
 *
 * @param {Buffer} cliPublic - client's public key
 * @param {SecBuf} cliSecret - client's secret key
 * @param {Buffer} srvPublic - server's public key
 * @param {string} lockLevel - the SecBuf.LOCK_* level of output SecBuf
 * @return {object} { rx /receive key/, tx /transmit key/ }
 */
exports.clientSession = function kxClientSession (cliPublic, cliSecret, srvPublic, lockLevel) {
  if (!(cliPublic instanceof Buffer)) {
    throw new Error('cliPublic must be a Buffer')
  }
  if (!(srvPublic instanceof Buffer)) {
    throw new Error('srvPublic must be a Buffer')
  }
  if (!(cliSecret instanceof SecBuf)) {
    throw new Error('cliSecret must be a SecBuf')
  }

  const rx = new SecBuf(sodium.crypto_kx_SESSIONKEYBYTES, lockLevel)
  const tx = new SecBuf(sodium.crypto_kx_SESSIONKEYBYTES, lockLevel)

  rx.writable((_rx) => {
    tx.writable((_tx) => {
      cliSecret.readable((_cliSecret) => {
        sodium.crypto_kx_client_session_keys(
          _rx, _tx, cliPublic, _cliSecret, srvPublic)
      })
    })
  })

  return { rx, tx }
}

/**
 * Given a client's public key, derive shared secrets.
 * @example
 * const { rx, tx } = mosodium.kx.serverSession(srvPub, srvSec, cliPub)
 *
 * @param {Buffer} srvPublic - server's public key
 * @param {SecBuf} srvSecret - server's secret key
 * @param {Buffer} cliPublic - client's public key
 * @param {string} lockLevel - the SecBuf.LOCK_* level of output SecBuf
 * @return {object} { rx /receive key/, tx /transmit key/ }
 */
exports.serverSession = function kxServerSession (srvPublic, srvSecret, cliPublic, lockLevel) {
  if (!(srvPublic instanceof Buffer)) {
    throw new Error('srvPublic must be a Buffer')
  }
  if (!(cliPublic instanceof Buffer)) {
    throw new Error('cliPublic must be a Buffer')
  }
  if (!(srvSecret instanceof SecBuf)) {
    throw new Error('srvSecret must be a SecBuf')
  }

  const rx = new SecBuf(sodium.crypto_kx_SESSIONKEYBYTES, lockLevel)
  const tx = new SecBuf(sodium.crypto_kx_SESSIONKEYBYTES, lockLevel)

  rx.writable((_rx) => {
    tx.writable((_tx) => {
      srvSecret.readable((_srvSecret) => {
        sodium.crypto_kx_server_session_keys(
          _rx, _tx, srvPublic, _srvSecret, cliPublic)
      })
    })
  })

  return { rx, tx }
}
