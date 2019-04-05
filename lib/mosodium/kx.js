const sodium = require('sodium-native')
const { SecBuf } = require('./secbuf')

const PUBLICKEY_BYTES = exports.PUBLICKEY_BYTES = sodium.crypto_kx_PUBLICKEYBYTES
const SECRETKEY_BYTES = exports.SECRETKEY_BYTES = sodium.crypto_kx_SECRETKEYBYTES
const SEED_BYTES = exports.SEED_BYTES = sodium.crypto_kx_SEEDBYTES
const SESSIONKEY_BYTES = exports.SESSIONKEY_BYTES = sodium.crypto_kx_SESSIONKEYBYTES

/**
 * Generate a fresh, random keyexchange keypair
 * @param {Buffer} - output publicKey
 * @param {Buffer} - output secretKey
 */
exports.kxKeypair = async function kxKeypair (publicKey, secretKey) {
  const [ sbPubKey, sbPrivKey ] = await Promise.all([
    SecBuf.ref(publicKey),
    SecBuf.ref(secretKey)
  ])

  if (sbPubKey.size() !== PUBLICKEY_BYTES) {
    throw new Error('bad publicKey size')
  }

  if (sbPrivKey.size() !== SECRETKEY_BYTES) {
    throw new Error('bad secretKey size')
  }

  await SecBuf.unlockMulti([
    [sbPubKey, 'writable'],
    [sbPrivKey, 'writable']
  ], (_publicKey, _secretKey) => {
    sodium.crypto_kx_keypair(_publicKey, _secretKey)
  })
}

/**
 * Generate a fresh, keyexchange keypair, based off a seed
 * @param {Buffer} - output publicKey
 * @param {Buffer} - output secretKey
 * @param {SecBuf} seed - the seed to derive a keypair from
 */
exports.kxSeedKeypair = async function kxSeedKeypair (publicKey, secretKey, seed) {
  const [ sbPubKey, sbPrivKey, sbSeed ] = await Promise.all([
    SecBuf.ref(publicKey),
    SecBuf.ref(secretKey),
    SecBuf.ref(seed)
  ])

  if (sbPubKey.size() !== PUBLICKEY_BYTES) {
    throw new Error('bad publicKey size')
  }

  if (sbPrivKey.size() !== SECRETKEY_BYTES) {
    throw new Error('bad secretKey size')
  }

  if (sbSeed.size() !== SEED_BYTES) {
    throw new Error('bad seed size')
  }

  await SecBuf.unlockMulti([
    [sbPubKey, 'writable'],
    [sbPrivKey, 'writable'],
    [sbSeed, 'readable']
  ], (_publicKey, _secretKey, _seed) => {
    sodium.crypto_kx_seed_keypair(_publicKey, _secretKey, _seed)
  })
}

/**
 * Given a server's public key, derive shared secrets.
 * @param {Buffer} rx - output rx /receive key/
 * @param {Buffer} tx - output tx /transmit key/
 * @param {Buffer} cliPublic - client's public key
 * @param {SecBuf} cliSecret - client's secret key
 * @param {Buffer} srvPublic - server's public key
 */
exports.kxClientSession = async function kxClientSession (rx, tx, cliPublic, cliSecret, srvPublic) {
  const [
    sbRx, sbTx, sbCliPub, sbCliPriv, sbSrvPub
  ] = await Promise.all([
    rx, tx, cliPublic, cliSecret, srvPublic
  ])

  if (sbRx.size() !== SESSIONKEY_BYTES) {
    throw new Error('bad rx size')
  }
  if (sbTx.size() !== SESSIONKEY_BYTES) {
    throw new Error('bad tx size')
  }

  await SecBuf.unlockMulti([
    [sbRx, 'writable'],
    [sbTx, 'writable'],
    [sbCliPub, 'readable'],
    [sbCliPriv, 'readable'],
    [sbSrvPub, 'readable']
  ], (_rx, _tx, _cliPub, _cliPriv, _srvPub) => {
    sodium.crypto_kx_client_session_keys(
      _rx, _tx, _cliPub, _cliPriv, _srvPub)
  })
}

/**
 * Given a client's public key, derive shared secrets.
 * @param {Buffer} rx - output rx /receive key/
 * @param {Buffer} tx - output tx /transmit key/
 * @param {Buffer} srvPublic - server's public key
 * @param {SecBuf} srvSecret - server's secret key
 * @param {Buffer} cliPublic - client's public key
 */
exports.kxServerSession = async function kxServerSession (rx, tx, srvPublic, srvSecret, cliPublic) {
  const [
    sbRx, sbTx, sbSrvPub, sbSrvPriv, sbCliPub
  ] = await Promise.all([
    rx, tx, srvPublic, srvSecret, cliPublic
  ])

  if (sbRx.size() !== SESSIONKEY_BYTES) {
    throw new Error('bad rx size')
  }
  if (sbTx.size() !== SESSIONKEY_BYTES) {
    throw new Error('bad tx size')
  }

  await SecBuf.unlockMulti([
    [sbRx, 'writable'],
    [sbTx, 'writable'],
    [sbSrvPub, 'readable'],
    [sbSrvPriv, 'readable'],
    [sbCliPub, 'readable']
  ], (_rx, _tx, _srvPub, _srvPriv, _cliPub) => {
    sodium.crypto_kx_server_session_keys(
      _rx, _tx, _srvPub, _srvPriv, _cliPub)
  })
}
