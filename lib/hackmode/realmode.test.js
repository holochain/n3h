const { expect } = require('chai')

const lib = require('./realmode')

describe('RealMode Suite', () => {
  it('should be a function', () => {
    expect(typeof lib.N3hRealMode).equals('function')
  })
})
