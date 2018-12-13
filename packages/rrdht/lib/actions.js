/**
 */
exports.registerPeer = function registerPeer (hash, peerInfo) {
  return {
    action: 'registerPeer',
    params: {
      hash,
      peerInfo
    }
  }
}
