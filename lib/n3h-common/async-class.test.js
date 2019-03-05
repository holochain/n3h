const { expect } = require('chai')
const { AsyncClass } = require('./index')
const sinon = require('sinon')

/**
 * since AsyncClass is intended to be subclassed... test it that way
 */
class StubClass extends AsyncClass {
  async init () {
    await super.init()
    this._realObj = true
    this.$pushDestructor(() => {
      if (!this._realObj) {
        throw new Error('uh oh... destroying wrong object')
      }
    })
  }
}

describe('AsyncClass Suite', () => {
  it('should be a function', () => {
    expect(typeof StubClass).equals('function')
  })

  it('should create and destroy', async () => {
    const i = await new StubClass()
    await i.destroy()
  })

  it('should generate ids', async () => {
    const i = await new StubClass()
    expect(i.$createUid()).not.equals(i.$createUid())
  })

  it('should be ok to destroy twice', async () => {
    const i = await new StubClass()
    await i.destroy()
    await i.destroy()
  })

  it('should not construct with bad inst', async () => {
    try {
      await AsyncClass.$construct(2, async () => {
        return new StubClass()
      })
    } catch (e) {
      return
    }
    throw await new Error('expected exception, got success')
  })

  it('should not construct with bad return', async () => {
    const i = await new StubClass()
    try {
      await AsyncClass.$construct(i, async () => {
        return 2
      })
    } catch (e) {
      return
    }
    throw await new Error('expected exception, got success')
  })

  it('should not allow methods after destroy', async () => {
    const i = await new StubClass()
    await i.destroy()
    try {
      i.on('yo', () => {})
    } catch (e) {
      return
    }
    throw await new Error('expected exception, got success')
  })

  it('should not allow push bad destructor', async () => {
    const i = await new StubClass()
    try {
      i.$pushDestructor(2)
    } catch (e) {
      return
    }
    throw await new Error('expected exception, got success')
  })

  it('should invoke destructor', async () => {
    const destructor = sinon.fake()
    const i = await new StubClass(destructor)
    await i.destroy()
    expect(destructor.calledOnce)
  })

  it('should invoke destructor (array)', async () => {
    const destructor = sinon.fake()
    const i = await new StubClass([destructor])
    await i.destroy()
    expect(destructor.calledOnce)
  })

  it('should ignore bad destructor', async () => {
    const i = await new StubClass(3)
    await i.destroy()
  })

  it('should emit', async () => {
    const fn = sinon.fake()
    const i = await new StubClass()
    i.on('test', fn)
    const res = await i.emit('test')
    await i.destroy()
    expect(fn.calledOnce)
    expect(res).deep.equals([undefined])
  })

  it('should emit twice with params / results', async () => {
    const i = await new StubClass()
    i.on('test', t => {
      return 'echo1:' + t
    })
    i.on('test', t => {
      return 'echo2:' + t
    })
    const res = await i.emit('test', 'hi')
    await i.destroy()
    expect(res).deep.equals(['echo1:hi', 'echo2:hi'])
  })

  it('should work to emit with no listeners', async () => {
    const i = await new StubClass()
    const res = await i.emit('test')
    await i.destroy()
    expect(res).deep.equals([])
  })
})
