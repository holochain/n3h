const { AsyncClass } = require('@holochain/n3h-common')

/**
 */
class WssConnection extends AsyncClass {
  /**
   */
  async init (passphrase, options) {
    await super.init()

    if (typeof passphrase !== 'string' || !passphrase.length) {
      throw new Error('passphrase required')
    }

    options || (options = {})
    this._options = {
      port: options.port || 8443,
      rsaBits: options.rsaBits || 4096,
      tlsFile: options.tlsFile || 'tls-data.json'
    }
  }
}

exports.WssConnection = WssConnection
