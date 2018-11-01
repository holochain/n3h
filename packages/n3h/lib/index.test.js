const { expect } = require('chai')

const { N3hNode } = require('./index')

describe('N3hNode Suite', () => {
  it('should be a function', () => {
    expect(typeof N3hNode).equals('function')
  })
})
