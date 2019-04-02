const expect = require('chai').expect
const sodium = require('./index')

describe('random Suite', () => {
  before(() => {
    sodium.SecBuf.setLockLevel(sodium.SecBuf.LOCK_NONE)
  })

  it('should random bytes', () => {
    expect(sodium.random.bytes(4).length).equals(4)
  })
})
