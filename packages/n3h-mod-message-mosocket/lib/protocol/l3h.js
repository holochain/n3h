const crypto = require('crypto')
const msgpack = require('msgpack-lite')

const mosodium = require('@holochain/mosodium')

const { MoSocket } = require('@holochain/mosocket')

exports.install = function installProtocolValidate (node) {
  return node._socket.installProtocol({
    name: 'l3h',
    version: '0.0.1',
    hooks: {
      /**
       */
      w: {
        pattern: MoSocket.PATTERN_NOTIFY_RELIABLE,
        initiator: {
          onNotifyReliable: () => {
            return msgpack.encode(Array.from(node._allNodes.values()).map(e => {
              // console.log('sending node', e)
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

      /**
       */
      v: {
        pattern: MoSocket.PATTERN_FIRST,
        initiator: {
          onPreauthReq: (ctx) => {
            ctx._r = crypto.randomBytes(32)
            return ctx._r
          },
          onRequest: (ctx) => {
            return Buffer.alloc(0)
          },
          onResponse: (ctx, msg) => {
            msg = msgpack.decode(msg.data)

            return {
              remoteId: msg.id,
              remoteEndpoint: msg.ep,
              signatureValid: mosodium.sign.verify(
                msg.sig, ctx._r, Buffer.from(msg.id, 'base64'))
            }
          }
        },
        responder: {
          onPreauthReq: (ctx, msg) => {
            ctx._r = msg.data
          },
          onRequest: (ctx, msg) => {
            const sig = mosodium.sign.sign(
              ctx._r, node._config.nodeId.secretKey)
            return msgpack.encode({
              id: node._config.nodeId.id,
              ep: node._socket.getListeningAddrs()[0],
              sig
            })
          }
        }
      }
    }
  })
}
