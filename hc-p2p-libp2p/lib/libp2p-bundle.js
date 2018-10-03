'use strict'

const libp2p = require('libp2p')
const Tcp = require('libp2p-tcp')
// const Spdy = require('libp2p-spdy')
const Mplex = require('libp2p-mplex')
// const SecIo = require('libp2p-secio')
const KadDht = require('libp2p-kad-dht')
const defaultsDeep = require('@nodeutils/defaults-deep')

class P2pBundle extends libp2p {
  constructor (_options) {
    const defaults = {
      modules: {
        transport: [ Tcp ],
        streamMuxer: [ Mplex ],
        // streamMuxer: [ Spdy ],
        // connEncryption: [ SecIo ],
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

exports.P2pBundle = P2pBundle
