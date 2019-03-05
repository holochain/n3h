const { expect } = require('chai')
const { $p } = require('./index')

describe('promisify Suite', () => {
  it('$p should promisify success', async () => {
    const fn = (cb) => {
      cb(null, 'yay')
    }
    const res = await $p(fn)
    expect(res).equals('yay')
  })

  it('$p should promisify fail', async () => {
    const fn = (cb) => {
      cb(new Error('fail'))
    }
    try {
      await $p(fn)
    } catch (e) {
      expect(e.toString()).contains('fail')
      return
    }
    throw new Error('expected exception, got success')
  })

  it('$p should fail if throw in top fn', async () => {
    const fn = (cb) => {
      throw new Error('fail')
    }
    try {
      await $p(fn)
    } catch (e) {
      expect(e.toString()).contains('fail')
      return
    }
    throw new Error('expected exception, got success')
  })
})
