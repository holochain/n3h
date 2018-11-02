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
    const srv = await new IpcServer()
    await srv.bind(['bla'])
    await srv.destroy()
  })

  it('should send pong on ping', (done) => {
    (async () => {
      const srv = await new IpcServer()
      await srv.bind(['bla'])
      const myDone = async (msg) => {
        await srv.destroy()
        done(msg)
      }
      srv._socket.on('_test_send', (data) => {
        try {
          const dec = msg.decode(data[2], data[3])
          expect(dec.name).equals('pong')
          expect(dec.data.orig).equals(42)
          myDone()
        } catch (e) {
          myDone(e)
        }
      })
      const { name, data } = msg.encode('ping', {
        sent: 42
      })
      srv._socket.emit('message', Buffer.alloc(0), Buffer.alloc(0), name, data)
    })().then(() => {}, done)
  })
})
