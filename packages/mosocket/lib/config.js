const mosodium = require('@holochain/mosodium')

module.exports = () => ({
  keys: {
    kx: mosodium.kx.keypair()
  },
  timeout: {
    newConnection: 1000
  }
})
