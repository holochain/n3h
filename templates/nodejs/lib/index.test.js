const { expect } = require('chai')
const sinon = require('sinon')

const lib = require('./index')

describe('Test Suite', () => {
  after(() => {
    sinon.restore()
  })

  it('should echo', () => {
    const spy = sinon.spy(lib, 'test')
    lib.test('hello')
    expect(spy.callCount).equals(1)
    expect(spy.alwaysReturned('echo: hello')).equals(true)
  })
})
