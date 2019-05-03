const { config } = require('../n3h-common')
const mosodium = require('../mosodium')

module.exports = exports = config.createDefinition({
  network: {
    id: config.entry({
      type: 'string',
      default: 'holochain closed alpha testnet d5d6c38c-648e-4ffc-b098-75d4181e639b',
      compute: async (base) => {
        const tmp = Buffer.alloc(32)
        await mosodium.hash.sha256(Buffer.from(base.id), tmp)
        base.idHash = tmp.toString('base64')
      }
    }),
    useTransientTransportId: config.entry({
      type: 'boolean',
      default: false
    })
  },
  ipc: {
    connection: {
      rsaBits: config.entry({
        type: 'number',
        // TODO - default to 4096, allow setting to 1024 for unit testing
        default: 1024
      }),
      bind: config.entry({
        type: 'arrayOf.url',
        default: ['wss://127.0.0.1:0/']
      })
    }
  },
  mdns: {
    enabled: config.entry({
      type: 'boolean',
      // TODO - default to false, true for alpha testnets
      default: true
    }),
    port: config.entry({
      type: 'number',
      default: 55455
    })
  },
  webproxy: {
    connection: {
      rsaBits: config.entry({
        type: 'number',
        // TODO - default to 4096, allow setting to 1024 for unit testing
        default: 1024
      }),
      bind: config.entry({
        type: 'arrayOf.url',
        // TODO - default ['wss://0.0.0.0:8443/'], allow random port for tests
        default: ['wss://0.0.0.0:0/']
      })
    },
    wssAdvertise: config.entry({
      type: 'string',
      default: 'auto'
    }),
    wssRelayPeers: config.entry({
      type: 'arrayOf.string'
      // no default, null unless specified
    })
  }
})
