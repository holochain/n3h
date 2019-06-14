const { DiscoveryEvent, Discovery } = require('../interface')
const { type, AsyncClass } = require('../n3h-common')

// const tweetlog = require('../tweetlog')
// const log = tweetlog('discovery-mdns')

const mdns = require('multicast-dns')

const SERVICE = 'SRV'

/**
 * Discover local (loopback or LAN) bootstrap peers using MDNS
 */
class DiscoveryMdns extends AsyncClass {
  /**
   * async constructor
   */
  async init (initOptions) {
    await super.init()

    if (!initOptions || !type.url(initOptions.advertise)) {
      throw new Error('initOptions.advertise must be a url')
    }
    this._advertise = initOptions.advertise

    if (!initOptions || !type.number(initOptions.port)) {
      throw new Error('initOptions.port must be a number')
    }
    this._port = initOptions.port

    if (!initOptions || !type.string(initOptions.id)) {
      throw new Error('initOptions.id must be a string')
    }
    this._id = initOptions.id

    this.discoveryInterface = this._iface = await new Discovery(this)
    let re = new RegExp('.*://([^:^/]*)')
    let hostname = initOptions.advertise.match(re)[1]
    this._mdns = mdns({
      multicast: true,
      port: this._port,
      loopback: true,
      reuseAddr: true,
      interface: hostname
    })

    this._mdns.on('response', response => {
      this._handleResponse(response).catch(e => { /* pass */ })
    })

    this._mdns.on('query', query => {
      this._handleQuery(query)
    })

    this._pingFreqSeconds = 1
    this._lastPing = Date.now()
    this._timerId = setInterval(() => {
      if (Date.now() - this._lastPing < this._pingFreqSeconds * 1000) {
        return
      }
      this._lastPing = Date.now()
      this._pingFreqSeconds += 1
      if (this._pingFreqSeconds > 30) {
        this._pingFreqSeconds = 30
      }
      this._mdns.query(this._id, SERVICE)
    }, 1000)

    this.$pushDestructor(async () => {
      clearInterval(this._timerId)

      await this._iface.destroy()
      this.discoveryInterface = null
      this._iface = null

      this._mdns.destroy()
      this._mdns = null
    })
  }

  // -- private -- //

  async _handleResponse (response) {
    const results = []
    if (response && response.answers) {
      for (let item of response.answers) {
        if (
          item.name === this._id &&
          item.type === SERVICE &&
          item.data &&
          item.data.target
        ) {
          if (type.url(item.data.target)) {
            results.push(item.data.target)
          }
        }
      }
    }
    if (results.length) {
      const res = await DiscoveryEvent.discovery(results)
      await this._iface.$emitEvent(res)
    }
  }

  _handleQuery (query) {
    if (query && query.questions) {
      for (let item of query.questions) {
        if (item.name === this._id && item.type === SERVICE) {
          this._mdns.respond([{
            name: this._id,
            type: SERVICE,
            data: {
              target: this._advertise
            }
          }])
        }
      }
    }
  }
}

exports.DiscoveryMdns = DiscoveryMdns
