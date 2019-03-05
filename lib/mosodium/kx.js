const sodium = require('sodium-native')
const { SecBuf } = require('./secbuf')

/**
 * Generate a fresh, random keyexchange keypair
 * @example
 * const { publicKey, secretKey } = mosodium.kx.keypair()
 *
 * @return {object} { publicKey, secretKey }
 */
exports.keypair = function kxKeypair () {
  const pk = Buffer.alloc(sodium.crypto_kx_PUBLICKEYBYTES)
  const sk = new SecBuf(sodium.crypto_kx_SECRETKEYBYTES)

  sk.writable((_sk) => {
    sodium.crypto_kx_keypair(pk, _sk)
  })

  return {
    publicKey: pk,
    secretKey: sk
  }
}

/**
 * Generate a fresh, keyexchange keypair, based off a seed
 * @example
 * const { publicKey, secretKey } = mosodium.kx.seedKeypair(seed)
 *
 * @param {SecBuf} seed - the seed to derive a keypair from
 * @return {object} { publicKey, secretKey }
 */
exports.seedKeypair = function kxSeedKeypair (seed) {
  if (!(seed instanceof SecBuf)) {
    throw new Error('seed must be a SecBuf')
  }

  const pk = Buffer.alloc(sodium.crypto_kx_PUBLICKEYBYTES)
  const sk = new SecBuf(sodium.crypto_kx_SECRETKEYBYTES)

  seed.readable(_seed => {
    sk.writable((_sk) => {
      sodium.crypto_kx_seed_keypair(pk, _sk, _seed)
    })
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
 * @return {object} { rx /receive key/, tx /transmit key/ }
 */
exports.clientSession = function kxClientSession (cliPublic, cliSecret, srvPublic) {
  if (!(cliPublic instanceof Buffer)) {
    throw new Error('cliPublic must be a Buffer')
  }
  if (!(srvPublic instanceof Buffer)) {
    throw new Error('srvPublic must be a Buffer')
  }
  if (!(cliSecret instanceof SecBuf)) {
    throw new Error('cliSecret must be a SecBuf')
  }

  const rx = new SecBuf(sodium.crypto_kx_SESSIONKEYBYTES)
  const tx = new SecBuf(sodium.crypto_kx_SESSIONKEYBYTES)

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
 * @return {object} { rx /receive key/, tx /transmit key/ }
 */
exports.serverSession = function kxServerSession (srvPublic, srvSecret, cliPublic) {
  if (!(srvPublic instanceof Buffer)) {
    throw new Error('srvPublic must be a Buffer')
  }
  if (!(cliPublic instanceof Buffer)) {
    throw new Error('cliPublic must be a Buffer')
  }
  if (!(srvSecret instanceof SecBuf)) {
    throw new Error('srvSecret must be a SecBuf')
  }

  const rx = new SecBuf(sodium.crypto_kx_SESSIONKEYBYTES)
  const tx = new SecBuf(sodium.crypto_kx_SESSIONKEYBYTES)

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
