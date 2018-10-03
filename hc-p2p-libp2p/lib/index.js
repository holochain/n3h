'use strict'

const crypto = require('crypto')
const EventEmitter = require('events')

const msgpack = require('msgpack-lite')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const pull = require('pull-stream/pull')
const { IpcServer } = require('ipc')

const { P2pBundle } = require('./libp2p-bundle')
const { $p } = require('./util')

function _sleep (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

function hash (data) {
  if (!(data instanceof Buffer)) {
    data = Buffer.from(data)
  }
  const h = crypto.createHash('sha256')
  h.update(data)
  return h.digest()
}

class Node extends EventEmitter {
  /**
   */
  constructor () {
    super()
    this._peerCache = new Map()
  }

  /**
   */
  async init (ipcBind, p2pBind) {
    await this._initP2pSocket(Array.isArray(p2pBind) ? p2pBind : [p2pBind])
    await this._initIpcSocket(Array.isArray(ipcBind) ? ipcBind : [ipcBind])
  }

  /**
   */
  async close () {
    this._peerCache.clear()
    this.removeAllListeners()
    this.setMaxListeners(0)
    if (this._ipc) {
      this._ipc.destroy()
      this._ipc = null
    }
    if (this._p2p) {
      /// ACK! HACK! is there a better way to do this??
      this._p2p._dht.randomWalk.stop()

      await $p(this._p2p.stop.bind(this._p2p))
      this._p2p = null
    }
  }

  /**
   */
  async connect (endpoint) {
    console.log('attempting to dial:', endpoint)
    await $p(this._p2p.dial.bind(this._p2p, endpoint))
    console.log('dial complete')
  }

  /**
   */
  getId () {
    return this._p2p.peerInfo.id.toB58String()
  }

  /**
   */
  getAddrs () {
    return this._p2p.peerInfo.multiaddrs.toArray().map(
      (a) => a.toString())
  }

  /**
   */
  listPeers () {
    return Array.from(this._peerCache.keys())
  }

  /**
   */
  send (toAddress, data) {
    // this needed??
    return this._p2pSend(toAddress, data)
  }

  /**
   */
  async store (key, val) {
    await $p(this._p2p.dht.put.bind(this._p2p.dht, hash(key), Buffer.from(val)))
  }

  /**
   */
  async fetch (key) {
    return $p(this._p2p.dht.get.bind(this._p2p.dht, hash(key)))
  }

  // -- private -- //

  /**
   */
  async _cachePeerFromConn (conn) {
    const peer = await $p(conn.getPeerInfo.bind(conn))
    this._peerCache.set(peer.id.toB58String(), peer)
    return peer.id.toB58String()
  }

  /**
   */
  async _fetchPeer (peerId) {
    if (this._peerCache.has(peerId)) {
      return this._peerCache.get(peerId)
    }
    const pr = this._p2p.peerRouting
    const start = Date.now()
    let peer = null
    while (Date.now() - start < 5000) {
      try {
        peer = await $p(pr.findPeer.bind(
          pr, PeerId.createFromB58String(peerId)))
      } catch (e) {
        peer = null
        await _sleep(100)
      }
    }
    if (!peer) {
      throw new Error('could not find peer')
    }
    if (peer.id.toB58String() !== peerId) {
      throw new Error('wtf')
    }
    this._peerCache.set(peerId, peer)
    return peer
  }

  /**
   */
  async _p2pSend (toAddress, data) {
    const peer = await this._fetchPeer(toAddress)
    const result = await new Promise(async (resolve, reject) => {
      const conn = await $p(this._p2p.dialProtocol.bind(this._p2p, peer, '/holomsg/0.0.1'))
      pull(makeGen(data), conn)
      pull(conn, makeSink((data) => {
        resolve(data)
      }))
    })
    return result
  }

  /**
   */
  async _initP2pSocket (p2pBind) {
    const me = await $p(PeerInfo.create)
    // const id = me.id.toB58String()

    for (let bind of p2pBind) {
      me.multiaddrs.add(bind)
    }

    const node = this._p2p = new P2pBundle({
      peerInfo: me
    })

    node.handle('/holomsg/0.0.1', async (protocol, conn) => {
      const peerId = await this._cachePeerFromConn(conn)
      pull(conn, makeSink(async (data) => {
        const query = msgpack.decode(data)
        switch (query.type) {
          case 'ping':
            pull(makeGen(msgpack.encode({
              type: 'pong',
              originTime: query.now,
              srvTime: Date.now()
            })), conn)
            break
          default:
            // throw new Error('unexpected holomsg type: ' + JSON.stringify(query))
            await new Promise((resolve, reject) => {
              this.emit('message', {
                data: {
                  from: peerId,
                  msg: query
                },
                resolve,
                reject
              })
            })
            pull(makeGen(data), conn)
        }
      }))
    })

    // this doesn't seem to ever be emitted
    // node.on('peer:discovery', (peer) => {
    //  console.log('DISCOVERY', peer.id.toB58String())
    // })

    node.on('peer:connect', async (peer) => {
      console.log('new peer', peer.id.toB58String())

      // side effect: adds this to our peer cache
      const result = msgpack.decode(await this._p2pSend(
        peer.id.toB58String(), msgpack.encode({
          type: 'ping',
          now: Date.now()
        })))
      console.log(' -- ping round trip -- ' + (
        Date.now() - result.originTime) + ' ms')
    })

    node.on('peer:disconnect', (peer) => {
      peer = peer.id.toB58String()
      console.log('lost peer', peer)
      this._peerCache.delete(peer)
    })

    await $p(node.start.bind(node))

    /// ACK! HACK! is there a better way to do this??
    node._dht.randomWalk.start(1, 5000, 10000)

    this.emit(
      'listening',
      this.getAddrs())
  }

  /**
   */
  async _initIpcSocket (ipcBind) {
    this._ipc = new IpcServer()
    this._ipc.on('call', opt => {
      this.emit('ipcMessage', {
        data: opt.data,
        resolve: opt.resolve,
        reject: opt.reject
      })
    })
    await this._ipc.bind(ipcBind)
  }

  /**
   */
  ipcSendMessage (data) {
    return this._ipc.call(data)
  }
}

/**
 */
function makeGen (data) {
  let sent = false
  return (end, fn) => {
    if (end) return fn(end)
    if (sent) {
      fn(true)
    } else {
      sent = true
      fn(null, data)
    }
  }
}

/**
 */
function makeSink (fn) {
  return (read) => {
    let data = Buffer.alloc(0)
    const next = (end, chunk) => {
      if (end === true) {
        fn(data)
        return
      }
      if (end) throw end
      data = Buffer.concat([data, chunk])
      setImmediate(() => {
        read(null, next)
      })
    }
    read(null, next)
  }
}

exports.Node = Node
