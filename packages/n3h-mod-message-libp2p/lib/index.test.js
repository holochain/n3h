const { expect } = require('chai')

const lib = require('./index')

describe('message libp2p Suite', () => {
  it('should be a function', () => {
    expect(typeof lib.MessageLibP2p).equals('function')
  })
})
