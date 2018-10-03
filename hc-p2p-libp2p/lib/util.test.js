const { expect } = require('chai')
const { $p } = require('./util')

describe('util Suite', () => {
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
})
