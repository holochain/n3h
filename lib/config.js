const mosocketConfig = require('mosocket').config
const crypto = require('crypto')

module.exports = () => ({
  mosocket: mosocketConfig(),
  nodeId: {
    id: crypto.randomBytes(32).toString('base64')
  }
})
