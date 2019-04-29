const { DiscoveryEvent, Discovery } = require('../interface')
const { type, AsyncClass } = require('../n3h-common')

// const tweetlog = require('../tweetlog')
// const log = tweetlog('discovery-mdns')

const mdns = require('multicast-dns')

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

    this._mdns = mdns({
      multicast: true,
      port: this._port,
      loopback: true,
      reuseAddr: true
    })

    this._mdns.on('response', r => {
      this._handleResponse(r).catch(e => {
        console.error('TODO FIX ME', e)
      })
    })

    this._mdns.on('query', q => {
      this._handleQuery(q)
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
      this._mdns.query(this._id, 'SRV')
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

  async _handleResponse (r) {
    const results = []
    if (r && r.answers) {
      for (let i of r.answers) {
        if (
          i.name === this._id &&
          i.type === 'SRV' &&
          i.data &&
          i.data.target
        ) {
          if (type.url(i.data.target)) {
            results.push(i.data.target)
          }
        }
      }
    }
    if (results.length) {
      const res = await DiscoveryEvent.discovery(results)
      await this._iface.$emitEvent(res)
    }
  }

  _handleQuery (q) {
    if (q && q.questions) {
      for (let i of q.questions) {
        if (i.name === this._id && i.type === 'SRV') {
          this._mdns.respond([{
            name: this._id,
            type: 'SRV',
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
