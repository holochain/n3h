const libp2p = require('libp2p')
const Tcp = require('libp2p-tcp')
const Mplex = require('libp2p-mplex')
const KadDht = require('libp2p-kad-dht')
const defaultsDeep = require('@nodeutils/defaults-deep')

class LibP2pBundle extends libp2p {
  constructor (_options) {
    const defaults = {
      modules: {
        transport: [ Tcp ],
        streamMuxer: [ Mplex ],
        dht: KadDht
      },
      config: {
        dht: {
          kBucketSize: 20
        },
        EXPERIMENTAL: {
          dht: true
        }
      }
    }

    super(defaultsDeep(_options, defaults))
  }
}

exports.LibP2pBundle = LibP2pBundle
