const { expect } = require('chai')

const { Pitr } = require('./index')

describe('Pitr Suite', () => {
  it('should be a function', () => {
    expect(typeof Pitr).equals('function')
  })
})
