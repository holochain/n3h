const EventEmitter = require('events')

class MockZmq extends EventEmitter {
  /*
  constructor () {
    super()
  }
  */

  setsockopt () {
  }

  bind (addr) {
    setImmediate(() => {
      this.emit('bind', addr)
    })
  }

  close () {
  }

  send (...args) {
    this.emit('_test_send', ...args)
  }
}

exports.MockZmq = MockZmq
