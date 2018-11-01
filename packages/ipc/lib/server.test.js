const expect = require('chai').expect
const sinon = require('sinon')

const zeromq = require('zeromq')

const { IpcServer } = require('./index')

const msg = require('./msg-types')

const MockZmq = require('../test/mock-zmq').MockZmq

describe('IpcServer Suite', () => {
  let stubSocket

  beforeEach(() => {
    stubSocket = sinon.stub(zeromq, 'socket').callsFake(() => new MockZmq())
  })

  afterEach(() => {
    stubSocket.restore()
  })

  it('should be a class', () => {
    expect(typeof IpcServer).equals('function')
  })

  it('should bind and close without errors', async () => {
    const srv = new IpcServer()
    await srv.bind(['bla'])
    srv.destroy()
  })

  it('should send pong on ping', (done) => {
    (async () => {
      const srv = new IpcServer()
      await srv.bind(['bla'])
      const myDone = (msg) => {
        srv.destroy()
        done(msg)
      }
      srv._socket.on('_test_send', (data) => {
        try {
          expect(data[2].readUInt8(0)).equals(msg.Message.PONG)
          myDone()
        } catch (e) {
          myDone(e)
        }
      })
      srv._socket.emit('message', Buffer.alloc(0), Buffer.alloc(0), Buffer.from([
        msg.Message.PING,
        0
      ]))
    })().then(() => {}, done)
  })
})
