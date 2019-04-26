const crypto = require('crypto')
const { DhtFullSync2 } = require('./index')
const { DhtEvent } = require('../interface')
const { $sleep } = require('../n3h-common')

describe('Dht Fullsync 2 Suite', () => {
  it('sanity', async () => {
    const instances = {}

    const create = async (name) => {
      const me = (await new DhtFullSync2({
        thisPeer: DhtEvent.peerHoldRequest(
          name, 'test://' + name, name, Object.keys(instances).length)
      })).interfaceDht
      instances[name] = me
      me.on('event', async e => {
        switch (e.type) {
          case 'gossipTo':
          case 'unreliableGossipTo':
            for (let peer of e.peerList) {
              await instances[peer].post(DhtEvent.remoteGossipBundle(
                name, e.bundle))
            }
            break
          case 'peerHoldRequest':
            await me.post(e)
            break
          case 'dataHoldRequest':
            await me.post(e)
            break
          case 'dataFetch':
            await me.post(DhtEvent.dataFetchResponse(
              e.msgId, Buffer.from(
                'data for: ' + e.dataAddress).toString('base64')))
            break
          default:
            console.error('unexpected unhandled message')
            console.error(e)
            break
        }
      })
      const t = crypto.randomBytes(3).toString('base64')
      await me.post(DhtEvent.dataHoldRequest(
        t, t))
    }

    await create('a')
    await create('b')

    await instances.a.post(instances.b.getThisPeer())

    await $sleep(700)

    for (let k in instances) {
      await instances[k].destroy()
    }
  })
})
