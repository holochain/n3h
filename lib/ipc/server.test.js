const expect = require('chai').expect
const sinon = require('sinon')

const zeromq = require('zeromq')

const Server = require('../index').ipc.Server

const ipcCommon = require('./msg-types')

const MockZmq = require('../../test/mock-zmq').MockZmq

describe('ipc.Server Suite', () => {
  let stubSocket

  beforeEach(() => {
    stubSocket = sinon.stub(zeromq, 'socket').callsFake(() => new MockZmq())
  })

  afterEach(() => {
    stubSocket.restore()
  })

  it('should be a class', () => {
    expect(typeof Server).equals('function')
  })

  it('should bind and close without errors', async () => {
    const srv = new Server(['bla'])
    await srv.ready()
    srv.close()
  })

  it('should send pong on ping', (done) => {
    (async () => {
      const srv = new Server(['bla'])
      await srv.ready()
      const myDone = (msg) => {
        srv.close()
        done(msg)
      }
      srv._socket.on('_test_send', (data) => {
        try {
          expect(data[2].readUInt8(0)).equals(ipcCommon.MSG_SRV.PONG)
          myDone()
        } catch (e) {
          myDone(e)
        }
      })
      srv._socket.emit('message', Buffer.alloc(0), Buffer.alloc(0), Buffer.from([
        ipcCommon.MSG_CLI.PING,
        0
      ]))
    })().then(() => {}, done)
  })
})
