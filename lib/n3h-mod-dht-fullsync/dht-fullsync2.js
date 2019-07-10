const crypto = require('crypto')

const {
  Track,
  AsyncClass,
  $sleep
} = require('../n3h-common')
const { Dht, DhtEvent } = require('../interface')

// const tweetlog = require('../tweetlog')
// const log = tweetlog('dht-fullsync')

/**
 * sha256 hash a string as utf8 bytes, return base64 of digest
 */
function getHash (str) {
  const hasher = crypto.createHash('sha256')
  hasher.update(Buffer.from(str, 'utf8'))
  return hasher.digest().toString('base64')
}

/**
 */
class DhtFullSync2 extends AsyncClass {
  /**
   */
  async init (initOptions) {
    await super.init()

    this._thisPeer = initOptions.thisPeer
    if (
      !this._thisPeer ||
      !DhtEvent.isEvent(this._thisPeer) ||
      this._thisPeer.type !== 'peerHoldRequest'
    ) {
      throw new Error('thisPeer required on dht init')
    }

    this.interfaceDht = this._iface = await new Dht(this)

    this._peerMap = new Map()
    this._peerMap.toJSON = function () { return Array.from(this.values()) }

    this._dataMap = new Map()
    this._dataMap.toJSON = function () { return Array.from(this) }

    this._dataFetchTrack = await new Track()

    this._gossipLoopContinue = true
    this._gossipLoopWait = new Promise((resolve, reject) => {
      this._gossipLoopResolve = resolve
    })

    this.$pushDestructor(async () => {
      // FIXME cancel track
      await this._dataFetchTrack.destroy()
      this._dataFetchTrack = null

      this._gossipLoopContinue = false
      await this._gossipLoopWait

      await this._iface.destroy()
      this.interfaceDht = this._iface = null

      this._peerMap.clear()
      this._peerMap = null

      this._dataMap.clear()
      this._dataMap = null
    })

    this._onPeerHoldRequest(this._thisPeer)

    this._gossip()
  }

  /**
   */
  getThisPeer () {
    return this._thisPeer
  }

  /**
   */
  async post (task) {
    switch (task.type) {
      case 'remoteGossipBundle':
        return this._onRemoteGossipBundle(task)
      case 'peerHoldRequest':
        return this._onPeerHoldRequest(task)
      case 'dataHoldRequest':
        return this._onDataHoldRequest(task)
      case 'dataFetchResponse':
        return this._onDataFetchResponse(task)
      case 'dataBroadcast':
        return this._broadcast(task)
    }
  }

  /**
   */
  getPeerLocal (peerAddress) {
    return this._peerMap.get(peerAddress)
  }

  /**
   */
  async fetchPeer (peerAddress) {
    // always pause a bit, simulates checking a remote
    await $sleep(200)

    const start = Date.now()
    while (!this.$isDestroyed() && Date.now() - start < 2000) {
      const peer = this.getPeerLocal(peerAddress)
      if (peer) {
        return peer
      }
      await $sleep(200)
    }
  }

  /**
   */
  dropPeerLocal (peerAddress) {
    // let's keep everyone around for now
    // this._peerMap.delete(peerAddress)
  }

  /**
   */
  async fetchDataLocal (dataAddress) {
    const id = this.$createUid()
    const p = this._dataFetchTrack.track(id)
    try {
      await this._iface.$emitEvent(DhtEvent.dataFetch(id, dataAddress))
    } catch (e) {
      console.log('@@', id, dataAddress, e)
      process.exit(34)
    }
    return p
  }

  /**
   */
  async fetchData (dataAddress) {
    // normally, if we were sharded, we'd make a remote request
    // and aggregate results. Since we're just going to return what
    // WE have... wait a bit to see if we gain additional data
    await $sleep(200)
    return this.fetchDataLocal(dataAddress)
  }

  // -- private -- //

  /**
   */
  async _onRemoteGossipBundle (task) {
    const res = JSON.parse(Buffer.from(task.bundle, 'base64').toString())
    switch (res.type) {
      case 'full1':
        await this._parseRemoteGossipFull(task.fromPeerAddress, res)
        this._sendFullGossipToPeer('full2', task.fromPeerAddress, res.id)
        break
      case 'full2':
        await this._parseRemoteGossipFull(task.fromPeerAddress, res)
        this._dataFetchTrack.resolve(res.id)
        break
      case 'wantData':
        const resp = {}
        const wait = []

        for (let addr of res.dataAddressList) {
          if (this._dataMap.has(addr)) {
            wait.push((async () => {
              try {
                resp[addr] = await this.fetchDataLocal(addr)
              } catch (e) {
                // we were not able to fetch the data,
                // just don't include it in the response.
              }
            })())
          }
        }

        await Promise.all(wait)

        await this._iface.$emitEvent(DhtEvent.gossipTo([task.fromPeerAddress],
          Buffer.from(JSON.stringify({
            type: 'wantDataResp', data: resp
          })).toString('base64')))
        break
      case 'wantDataResp':
        for (let k in res.data) {
          await this._iface.$emitEvent(DhtEvent.dataHoldRequest(
            k, res.data[k]))
        }
        break
      default:
        console.error('unexpected unhandled remote gossip type')
        console.error(JSON.stringify(res, null, 2))
    }
  }

  /**
   */
  async _onPeerHoldRequest (task) {
    if (!this._peerMap.has(task.peerAddress)) {
      this._peerMap.set(task.peerAddress, task)
      return
    }
    const ref = this._peerMap.get(task.peerAddress)
    if (ref.peerTs < task.peerTs) {
      this._peerMap.set(task.peerAddress, task)
    }
  }

  /**
   * item = entryAspect in base64 JSON
   */
  async _onDataHoldRequest (task) {
    for (let item of task.dataList) {
      item = Buffer.from(item, 'base64').toString()
      const hash = getHash(item)

      // Holding new entry: create aspect set
      if (!this._dataMap.has(task.dataAddress)) {
        const set = new Set()
        set.toJSON = function () { return Array.from(this.keys()) }
        this._dataMap.set(task.dataAddress, set)
      }

      this._dataMap.get(task.dataAddress).add(hash)
    }
  }

  /**
   * Send the data to every known peer
   * item = entryAspect in base64 JSON
   */
  async _broadcast (task) {
    // everyone except ourselves
    const peerList = Array.from(this._peerMap.keys())
      .filter(a => a !== this._thisPeer.peerAddress)
    const resp = {}
    resp[task.dataAddress] = [task.dataItem]
    // log.t('_broadcast', peerList, resp)
    await this._iface.$emitEvent(DhtEvent.gossipTo(peerList,
      Buffer.from(JSON.stringify({
        type: 'wantDataResp', data: resp
      })).toString('base64')))
  }

  /**
   */
  async _onDataFetchResponse (task) {
    this._dataFetchTrack.resolve(task.msgId, task.dataList)
  }

  /**
   */
  async _gossip () {
    while (this._gossipLoopContinue) {
      // -- pick peers -- //

      const peerList = Array.from(this._peerMap.keys()).sort(
        (a, b) => Math.random() > 0.5 ? -1 : 1)

      for (let peer of peerList) {
        if (!this._gossipLoopContinue) break

        // don't gossip to ourselves
        if (peer === this._thisPeer.peerAddress) {
          continue
        }

        try {
          await this._gossipToPeer(peer)
        } catch (e) { /* pass */ }

        if (!this._gossipLoopContinue) break

        // -- wait a bit before gossiping with next peer -- //
        await $sleep(100)
      }

      if (!this._gossipLoopContinue) break

      // -- wait a bit before looping -- //
      await $sleep(200)
    }

    this._gossipLoopResolve()
  }

  /**
   */
  async _parseRemoteGossipFull (fromPeerAddress, data) {
    for (let peer of data.peer) {
      if (this._peerMap.has(peer.peerAddress)) {
        const ref = this._peerMap.get(peer.peerAddress)
        if (ref.peerTs >= peer.peerTs) {
          continue
        }
      }
      await this._iface.$emitEvent(DhtEvent.peerHoldRequest(
        peer.peerAddress, peer.peerTransport, peer.peerData, peer.peerTs))
    }

    const wantData = []
    for (let [dataAddress, dataHashList] of data.data) {
      for (let dataHash of dataHashList) {
        if (this._dataMap.has(dataAddress)) {
          const ref = this._dataMap.get(dataAddress)
          if (ref.has(dataHash)) {
            continue
          }
        }
        wantData.push(dataAddress)
        break
      }
    }

    if (wantData.length > 0) {
      this._iface.$emitEvent(DhtEvent.gossipTo([fromPeerAddress],
        Buffer.from(JSON.stringify({
          type: 'wantData', dataAddressList: wantData
        })).toString('base64')))
    }
  }

  /**
   */
  async _gossipToPeer (peerAddress) {
    const id = this.$createUid()
    this._sendFullGossipToPeer('full1', peerAddress, id)
    return this._dataFetchTrack.track(id)
  }

  /**
   */
  _sendFullGossipToPeer (type, peerAddress, id) {
    const data = JSON.stringify({
      id,
      type,
      peer: this._peerMap,
      data: this._dataMap
    })
    this._iface.$emitEvent(DhtEvent.gossipTo([peerAddress],
      Buffer.from(data).toString('base64')))
  }
}

exports.DhtFullSync2 = DhtFullSync2
