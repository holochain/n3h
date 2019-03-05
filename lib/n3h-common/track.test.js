const { Track, $sleep } = require('./index')
const { expect } = require('chai')

describe('Track Suite', () => {
  let t = null

  beforeEach(async () => {
    t = await new Track()
  })

  afterEach(async () => {
    await t.destroy()
  })

  it('can construct default', async () => {
    await (await new Track()).destroy()
  })

  it('track and resolve - a', async () => {
    const b = []
    t.track('bob').then(a => b.push(a), a => b.push(a.toString()))
    t.track('ned').then(a => b.push(a), a => b.push(a.toString()))
    t.resolve('ned', 'test1')
    await $sleep(0)
    t.resolve('ned', 'test2')
    await $sleep(0)
    t.reject('ned', new Error('err1'))
    await $sleep(0)
    t.resolve('bob', 'test3')
    await $sleep(0)
    expect(b).deep.equals(['test1', 'test3'])
  })

  it('track and resolve - b', async () => {
    const b = []
    t.track('bob').then(a => b.push(a), a => b.push(a.toString()))
    t.track('ned').then(a => b.push(a), a => b.push(a.toString()))
    t.reject('ned', new Error('err1'))
    await $sleep(0)
    t.resolve('ned', 'test1')
    await $sleep(0)
    t.resolve('ned', 'test2')
    await $sleep(0)
    t.resolve('bob', 'test3')
    await $sleep(0)
    expect(b).deep.equals(['Error: err1', 'test3'])
  })

  it('timeout', async () => {
    await t.destroy()
    t = await new Track({
      timeout: 100
    })
    try {
      await t.track('nothin')
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('destroying', async () => {
    const b = []
    t.track('nothin').then(a => b.push(a), a => b.push(a.toString()))
    await t.destroy()
    expect(b).deep.equals(['Error: destroying'])
  })

  it('should not allow duplicate track', async () => {
    t.track('nothin').catch(() => {})
    try {
      await t.track('nothin')
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })
})
