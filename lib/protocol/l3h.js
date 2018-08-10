const crypto = require('crypto')
const msgpack = require('msgpack-lite')

const { MoSocket } = require('mosocket')

exports.install = function installProtocolValidate (node) {
  return node._socket.installProtocol({
    name: 'l3h',
    version: '0.0.1',
    hooks: {
      w: {
        pattern: MoSocket.PATTERN_NOTIFY_RELIABLE,
        initiator: {
          onNotifyReliable: (ctx) => {
            return msgpack.encode(Array.from(node._allNodes.values()).map(e => {
              return [ e.remoteId, e.remoteEndpoint ]
            }))
          }
        },
        responder: {
          onNotifyReliable: (msg) => {
            node.$checkGossip(msgpack.decode(msg.data))
          }
        }
      },
      v: {
        pattern: MoSocket.PATTERN_FIRST,
        initiator: {
          onPreauthReq: (ctx) => {
            ctx._r = crypto.randomBytes(32).toString('base64')
            return msgpack.encode({
              r: ctx._r
            })
          },
          onRequest: (ctx) => {
            return Buffer.alloc(0)
          },
          onResponse: (ctx, msg) => {
            msg = msgpack.decode(msg.data)
            return {
              remoteId: msg.id,
              remoteEndpoint: msg.ep,
              ourNonce: ctx._r,
              signature: msg.sig
            }
          }
        },
        responder: {
          onPreauthReq: (ctx, msg) => {
            ctx._r = msgpack.decode(msg.data).r
          },
          onRequest: (ctx, msg) => {
            return msgpack.encode({
              id: node._config.nodeId.id,
              ep: node._socket.getListeningAddrs()[0],
              sig: 'mvp-stub'
            })
          }
        }
      }
    }
  })
}
