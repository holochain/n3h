const expect = require('chai').expect

const common = require('./common')

describe('common Suite', () => {
  let ci = null

  beforeEach(() => {
    ci = new common.EventClass()
  })

  it('should make a lot of unique ids', () => {
    const s = new Set()
    for (let i = 0; i < 10000; ++i) {
      const id = ci.$nextId().toString('base64')
      if (s.has(id)) {
        throw new Error('generated non-unique id: ' + id)
      }
      s.add(id)
    }
  })

  it('should handle timeout promise resolve', async () => {
    expect(await ci.$timeoutPromise((resolve, reject) => {
      resolve(true)
    })).equals(true)
  })

  it('should handle timeout promise reject', async () => {
    try {
      await ci.$timeoutPromise((resolve, reject) => {
        reject(new Error('test'))
      })
    } catch (e) {
      // yay
      return
    }
    throw new Error('expected exception, but got success')
  })
})
