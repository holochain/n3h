const { expect } = require('chai')

const lib = require('./index')

describe('Mock Suite', () => {
  it('should be a function', () => {
    expect(typeof lib.N3hMock).equals('function')
  })
})
