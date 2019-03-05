const expect = require('chai').expect
const sodium = require('./index')

describe('kdf Suite', () => {
  before(() => {
    sodium.SecBuf.setLockLevel(sodium.SecBuf.LOCK_NONE)
  })

  it('should throw on bad derive index', () => {
    expect(() => {
      sodium.kdf.derive('hi')
    }).throws()
  })

  it('should throw on bad derive context', () => {
    expect(() => {
      sodium.kdf.derive(3, Buffer.from([1]))
    }).throws()
  })

  it('should throw on bad derive parent', () => {
    expect(() => {
      sodium.kdf.derive(3, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))
    }).throws()
  })

  it('should derive consistantly', () => {
    const context = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])
    const _parent = new sodium.SecBuf(32)
    _parent.randomize()

    const d1 = sodium.kdf.derive(3, context, _parent)
    const d2 = sodium.kdf.derive(3, context, _parent)

    _parent.free()

    d1.readable(_d1 => {
      d2.readable(_d2 => {
        expect(_d1.toString('base64')).equals(_d2.toString('base64'))
      })
    })

    d1.free()
    d2.free()
  })
})
