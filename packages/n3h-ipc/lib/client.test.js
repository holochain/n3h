const expect = require('chai').expect

const { IpcClient } = require('./index')

describe('IpcClient Suite', () => {
  it('should be a class', () => {
    expect(typeof IpcClient).equals('function')
  })
})
