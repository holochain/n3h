const mosodium = require('mosodium')

module.exports = () => ({
  keys: {
    kx: mosodium.kx.keypair()
  },
  timeout: {
    newConnection: 1000
  }
})
