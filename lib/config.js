const os = require('os')
const path = require('path')

const mosodium = require('mosodium')

const mosocketConfig = require('mosocket').config

class EphemeralNode {
  constructor () {
    const seed = new mosodium.SecBuf(32)
    seed.randomize()
    const { publicKey, secretKey } = mosodium.sign.seedKeypair(seed)
    seed.free()

    this.publicKey = publicKey
    this.secretKey = secretKey
    this.id = this.publicKey.toString('base64')
  }
}

module.exports = () => ({
  mosocket: mosocketConfig(),
  nodeId: new EphemeralNode(),
  ipc: {
    socket: 'ipc://' + path.resolve(path.join(os.homedir(), 'n3h.ipc.socket'))
  }
})
