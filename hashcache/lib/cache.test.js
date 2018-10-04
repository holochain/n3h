const { HashCache } = require('./index')
const { expect } = require('chai')
const crypto = require('crypto')

function _sleep (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

let CACHE_SIZE = null
let DISPATCH_TIMEOUT = null

class TestCache {
  static async create () {
    const i = await HashCache.connect({
      backend: {
        type: 'sqlite3',
        config: {
          file: ':memory:'
        }
      },
      cacheSize: CACHE_SIZE,
      dispatchTimeout: DISPATCH_TIMEOUT
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

    i.registerAction('setData', async (action) => {
      const out = new Map()
      for (const [hash, item] of action.fetch) {
        item.data = action.data
        out.set(hash, item)
      }
      return out
    })

    i.registerAction('longTime', async (action) => {
      await _sleep(100)
    })

    const out = new TestCache()
    out._i = i
    return out
  }

  get (hash) {
    return this._i.get('test', hash)
  }

  incrCount (hash) {
    return this._i.dispatch({
      type: 'incrCount', ns: 'test', fetch: [ hash ]
    })
  }

  setData (hash, data) {
    return this._i.dispatch({
      type: 'setData',
      ns: 'test',
      data,
      fetch: [ hash ]
    })
  }

  longTime () {
    return this._i.dispatch({
      type: 'longTime',
      ns: 'test',
      fetch: []
    })
  }
}

describe('HashCache Suite', () => {
  beforeEach(() => {
    CACHE_SIZE = null
    DISPATCH_TIMEOUT = null
  })

  it('should be a function', () => {
    expect(typeof HashCache).equals('function')
  })

  it('should fail on bad registerAction type', async () => {
    const i = await TestCache.create()
    try {
      await i._i.registerAction(2, () => {})
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should fail on bad registerAction fn', async () => {
    const i = await TestCache.create()
    try {
      await i._i.registerAction('test', 2)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should fail on bad registerAction - double set', async () => {
    const i = await TestCache.create()
    await i._i.registerAction('test', () => {})
    try {
      await i._i.registerAction('test', () => {})
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should fail on action result not iterable', async () => {
    const i = await TestCache.create()
    await i._i.registerAction('test', () => ({}))
    try {
      await i._i.dispatch({
        type: 'test',
        ns: 'test',
        fetch: []
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should fail on dispatch timeout', async () => {
    DISPATCH_TIMEOUT = 5
    const i = await TestCache.create()
    try {
      await i.longTime()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should fail on bad action - not an object', async () => {
    const i = await TestCache.create()
    try {
      await i._i.dispatch(2)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should fail on bad action - bad type', async () => {
    const i = await TestCache.create()
    try {
      await i._i.dispatch({
        type: 'hello',
        ns: 'hello',
        fetch: [
          crypto.randomBytes(32).toString('base64')
        ]
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should fail on bad action - bad type', async () => {
    const i = await TestCache.create()
    try {
      await i._i.dispatch({
        type: 2,
        ns: 'hello',
        fetch: [
          crypto.randomBytes(32).toString('base64')
        ]
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should fail on bad action - bad ns', async () => {
    const i = await TestCache.create()
    try {
      await i._i.dispatch({
        type: 'incrCount',
        ns: 2,
        fetch: [
          crypto.randomBytes(32).toString('base64')
        ]
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should fail on bad action - bad fetch', async () => {
    const i = await TestCache.create()
    try {
      await i._i.dispatch({
        type: 'incrCount',
        ns: 'hello',
        fetch: 2
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should fail on bad action - bad fetch contents', async () => {
    const i = await TestCache.create()
    try {
      await i._i.dispatch({
        type: 'incrCount',
        ns: 'hello',
        fetch: [
          2
        ]
      })
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should set and get', async () => {
    const hash = crypto.randomBytes(32).toString('base64')
    const i = await TestCache.create()

    await Promise.all([
      i.incrCount(hash),
      i.incrCount(hash)
    ])

    const res = await i.get(hash)

    expect(res.count).equals(2)
  })

  it('should lru', async () => {
    CACHE_SIZE = 3000
    const i = await TestCache.create()

    for (let j = 0; j < 4; ++j) {
      await i.setData(
        crypto.randomBytes(32).toString('base64'),
        crypto.randomBytes(512).toString('hex')
      )
      await _sleep((Math.random() * 2 + 2) | 0)
    }

    expect(i._i._data._currentSize).lessThan(3000)
  })
})
