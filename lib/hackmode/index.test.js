const { expect } = require('chai')

const lib = require('./index')

describe('HackMode Suite', () => {
  it('should be a function', () => {
    expect(typeof lib.N3hHackMode).equals('function')
  })
})
