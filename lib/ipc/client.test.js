const expect = require('chai').expect

const Client = require('../index').ipc.Client

describe('ipc.Client Suite', () => {
  it('should be a class', () => {
    expect(typeof Client).equals('function')
  })
})
