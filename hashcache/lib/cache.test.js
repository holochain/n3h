const { HashCache } = require('./cache')
const { expect } = require('chai')
const crypto = require('crypto')

function _sleep (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

describe('HashCache Suite', () => {
  it('should be a function', () => {
    expect(typeof HashCache).equals('function')
  })

  it('should set and get', async () => {
    const hash = crypto.randomBytes(32).toString('base64')
    const i = await HashCache.connect({
      sqlite3: {
        file: ':memory:'
      }
    })

    i.registerAction('incrCount', async (action) => {
      const out = new Map()
      for (const [hash, item] of action.fetch) {
        if (typeof item.count !== 'number') {
          item.count = 1
        } else {
          ++item.count
        }
        out.set(hash, item)
      }
      return out
    })

    const incrCount = _hash => ({ type: 'incrCount', fetch: [ _hash ] })

    await Promise.all([
      i.dispatch(incrCount(hash)),
      i.dispatch(incrCount(hash))
    ])
    const res = await i.get(hash)
    expect(res.count).equals(2)
  })

  it('should lru', async () => {
    const i = await HashCache.connect({
      sqlite3: {
        file: ':memory:'
      },
      cacheSize: 3000
    })

    i.registerAction('setData', async (action) => {
      const out = new Map()
      for (const [hash, item] of action.fetch) {
        item.data = crypto.randomBytes(512).toString('hex')
        out.set(hash, item)
      }
      return out
    })

    for (let j = 0; j < 4; ++j) {
      await i.dispatch({
        type: 'setData',
        fetch: [ crypto.randomBytes(32).toString('base64') ]
      })
      await _sleep((Math.random() * 10 + 10) | 0)
    }
  })
})
