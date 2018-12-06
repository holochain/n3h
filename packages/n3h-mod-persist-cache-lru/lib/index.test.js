const crypto = require('crypto')

const { expect } = require('chai')

const { ModMod } = require('@holochain/n3h-common')
const PersistCacheLru = require('./index').PersistCacheLru

const NS = 'test'

const bail = e => { throw new Error(e) }

function _sleep (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

const zero = Buffer.from([0])
let stubData = {}
const nvStub = {
  start: () => {
    stubData = {}
  },
  destroy: () => {},
  get: (nv, key) => {
    key instanceof Buffer || bail('key type')
    return stubData[Buffer.concat([Buffer.from(nv), zero, key])]
  },
  set: (nv, key, data) => {
    key instanceof Buffer || bail('key type')
    data instanceof Buffer || bail('data type')
    stubData[Buffer.concat([Buffer.from(nv), zero, key])] = data
  },
  ready: () => {}
}

async function addRand (cache, keyIdx, size) {
  const bytes = crypto.randomBytes(size)
  await cache.set(NS, Buffer.from(keyIdx.toString()), bytes)
}

describe('PersistCacheLRU Suite', () => {
  let m = null
  let i = null
  let c = null

  beforeEach(async () => {
    stubData = {}
    m = await new ModMod({
      nvPersist: ['get', 'set'],
      persistCache: ['get', 'set', 'getNsAsStringJson']
    })
    m.register([
      PersistCacheLru,
      class {
        static getDefinition () {
          return {
            type: 'nvPersist',
            name: 'testStub',
            defaultConfig: {}
          }
        }

        constructor () {
          return nvStub
        }
      }
    ])

    const defaultConfig = JSON.parse(m.getDefaultConfig())
    defaultConfig.persistCache.lru.config.cacheSize = 500

    i = await m.launch(defaultConfig)
    c = i.persistCache
  })

  afterEach(async () => {
    await m.destroy()
  })

  it('should be an instance', () => {
    expect(typeof c).equals('object')
  })

  it('should set and get', async () => {
    await c.set(NS, Buffer.from('bla'), Buffer.from('hello'))
    expect((await c.get(NS, Buffer.from('bla'))).toString()).equals('hello')
  })

  it('should set and get (StringJson)', async () => {
    const t = c.getNsAsStringJson(NS)
    await t.set('bla', 'hello')
    expect(await t.get('bla')).equals('hello')
  })

  it('should update', async () => {
    await c.set(NS, Buffer.from('bla'), Buffer.from('hello'))
    await c.set(NS, Buffer.from('bla'), Buffer.from('zoik'))
    expect((await c.get(NS, Buffer.from('bla'))).toString()).equals('zoik')
  })

  it('should get null', async () => {
    expect(await c.get(NS, Buffer.from('bla'))).equals(null)
  })

  it('should get null (StringJson)', async () => {
    const t = c.getNsAsStringJson(NS)
    expect(await t.get('bla')).equals(null)
  })

  it('should drop LRU', async () => {
    for (let i = 0; i < 10; ++i) {
      await addRand(c, i, 101)
      expect(c._._currentSize).lessThan(500)
    }
  })

  it('can fetch dropped items', async () => {
    await c.set(NS, Buffer.from('bla'), Buffer.from('hello'))
    await _sleep(5)
    await addRand(c, 1, 499)
    await addRand(c, 2, 499)
    expect(c._._currentSize).lessThan(500)
    expect((await c.get(NS, Buffer.from('bla'))).toString()).equals('hello')
  })

  it('should LRU sort order', async () => {
    for (let i = 0; i < 10; ++i) {
      await addRand(c, i, 101)
      await _sleep(1)

      // get the first one to update the timestamp
      await c.get(NS, Buffer.from((1).toString()))

      expect(c._._currentSize).lessThan(500)
    }
  })
})
