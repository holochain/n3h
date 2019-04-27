const { expect } = require('chai')
const { DhtFullSync2 } = require('./index')
const { DhtEvent } = require('../interface')
const { $sleep } = require('../n3h-common')

describe('Dht Fullsync 2 Suite', () => {
  it('sanity', async () => {
    const sharedData = {
      data1: [
        { type: 'entry', value: 'entry1' },
        { type: 'meta', value: 'entry1meta1' },
        { type: 'meta', value: 'entry1meta2' }
      ],
      data2: [
        { type: 'entry', value: 'entry2' },
        { type: 'meta', value: 'entry2meta1' },
        { type: 'meta', value: 'entry2meta2' }
      ]
    }

    const encodeData = (addr) => {
      return sharedData[addr].map(t => {
        return Buffer.from(JSON.stringify(t)).toString('base64')
      })
    }

    const instances = {}

    const create = async (name) => {
      const me = (await new DhtFullSync2({
        thisPeer: DhtEvent.peerHoldRequest(
          name, 'test://' + name, name, Object.keys(instances).length)
      })).interfaceDht
      instances[name] = me
      let meAddr = null
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
            meAddr = '_$_' + e.dataAddress
            me[meAddr] = e.dataList
            await me.post(e)
            break
          case 'dataFetch':
            meAddr = '_$_' + e.dataAddress
            if (!(meAddr in me)) {
              await me.post(DhtEvent.dataFetchResponse(e.msgId, []))
              return
            }
            await me.post(DhtEvent.dataFetchResponse(
              e.msgId, me['_$_' + e.dataAddress]))
            break
          default:
            console.error('unexpected unhandled message')
            console.error(e)
            break
        }
      })
    }

    await create('a')
    instances.a['_$_data1'] = encodeData('data1')
    await instances.a.post(DhtEvent.dataHoldRequest(
      'data1', encodeData('data1')))
    await create('b')
    instances.b['_$_data2'] = encodeData('data2')
    await instances.b.post(DhtEvent.dataHoldRequest(
      'data2', encodeData('data2')))

    await instances.a.post(instances.b.getThisPeer())

    await $sleep(700)

    let res = null

    res = (await instances.a.fetchDataLocal('data2')).map(
      e => JSON.parse(Buffer.from(e, 'base64').toString()))
    expect(sharedData.data2).deep.equals(res)

    res = (await instances.b.fetchDataLocal('data1')).map(
      e => JSON.parse(Buffer.from(e, 'base64').toString()))
    expect(sharedData.data1).deep.equals(res)

    for (let k in instances) {
      await instances[k].destroy()
    }
  }).timeout(10000)
})
