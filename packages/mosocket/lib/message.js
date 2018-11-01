const msgpack = require('msgpack-lite')

const MsgType = exports.MsgType = {
  keepAlive: 0x00,

  noticeReliable: 0x10,
  noticeUnreliable: 0x11,

  preauthReq: 0x20,
  preauthAck: 0x21,
  preauthAccept: 0x22,
  preauthStop: 0x23,

  reqData: 0x30,
  reqDataCont: 0x31,

  resData: 0x40,
  resDataCont: 0x41
}

exports.newNoticeReliable = function newNoticeReliable (protoHash, hookName, data) {
  return Buffer.concat([
    Buffer.from([MsgType.noticeReliable]),
    msgpack.encode([protoHash, hookName, data])
  ])
}

exports.newPreauthReq = function newPreauthReq (protoHash, msgId, hookName, data) {
  return Buffer.concat([
    Buffer.from([MsgType.preauthReq]),
    msgpack.encode([protoHash, msgId, hookName, data])
  ])
}

exports.newPreauthAck = function newPreauthAck (msgId) {
  return Buffer.concat([
    Buffer.from([MsgType.preauthAck]),
    msgpack.encode([msgId])
  ])
}

exports.newPreauthAccept = function newPreauthAccept (msgId) {
  return Buffer.concat([
    Buffer.from([MsgType.preauthAccept]),
    msgpack.encode([msgId])
  ])
}

exports.newPreauthStop = function newPreauthStop (msgId, text) {
  return Buffer.concat([
    Buffer.from([MsgType.preauthStop]),
    msgpack.encode([msgId, text.toString()])
  ])
}

exports.newRequest = function newRequest (msgId, data) {
  const out = []
  out.push(Buffer.concat([
    Buffer.from([MsgType.reqData]),
    msgpack.encode([msgId, data.byteLength, data.slice(0, 4096)])
  ]))
  for (let i = 4096; i < data.byteLength; i += 4096) {
    out.push(Buffer.concat([
      Buffer.from([MsgType.reqDataCont]),
      msgpack.encode([msgId, data.slice(i, i + 4096)])
    ]))
  }
  return out
}

exports.newResponse = function newResponse (msgId, data) {
  const out = []
  out.push(Buffer.concat([
    Buffer.from([MsgType.resData]),
    msgpack.encode([msgId, data.byteLength, data.slice(0, 4096)])
  ]))
  for (let i = 4096; i < data.byteLength; i += 4096) {
    out.push(Buffer.concat([
      Buffer.from([MsgType.resDataCont]),
      msgpack.encode([msgId, data.slice(i, i + 4096)])
    ]))
  }
  return out
}

exports.parse = function parse (buffer) {
  const msgType = buffer.readUInt8(0)
  let data = null
  switch (msgType) {
    case MsgType.noticeReliable:
      data = msgpack.decode(buffer.slice(1))
      return {
        type: msgType,
        protoHash: data[0],
        hookName: data[1],
        data: data[2]
      }
    case MsgType.preauthReq:
      data = msgpack.decode(buffer.slice(1))
      return {
        type: msgType,
        protoHash: data[0],
        msgId: data[1],
        hookName: data[2],
        data: data[3]
      }
    case MsgType.preauthAck:
      data = msgpack.decode(buffer.slice(1))
      return {
        type: msgType,
        msgId: data[0]
      }
    case MsgType.preauthAccept:
      data = msgpack.decode(buffer.slice(1))
      return {
        type: msgType,
        msgId: data[0]
      }
    case MsgType.preauthStop:
      data = msgpack.decode(buffer.slice(1))
      return {
        type: msgType,
        msgId: data[0],
        text: data[1]
      }
    case MsgType.reqData:
      data = msgpack.decode(buffer.slice(1))
      return {
        type: msgType,
        msgId: data[0],
        length: data[1],
        data: data[2]
      }
    case MsgType.resData:
      data = msgpack.decode(buffer.slice(1))
      return {
        type: msgType,
        msgId: data[0],
        length: data[1],
        data: data[2]
      }
    default:
      throw new Error('unhandled msgtype: 0x' + msgType.toString(16))
  }
}
