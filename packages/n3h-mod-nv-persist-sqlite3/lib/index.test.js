const NvPersistSqlite3 = require('./index').NvPersistSqlite3
const { ModMod } = require('@holochain/n3h-common')
const { expect } = require('chai')
const crypto = require('crypto')

const NS = 'test'

async function construct (config) {
  const m = await new ModMod({
    nvPersist: ['get', 'set']
  })
  m.register(NvPersistSqlite3)
  const defaultConfig = JSON.parse(m.getDefaultConfig())
  defaultConfig.nvPersist.sqlite3.config = config
  return m.launch(defaultConfig)
}

describe('NvPersistSqlite3 Suite', () => {
  it('should error with no config', async () => {
    try {
      await construct()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should error with empty config', async () => {
    try {
      await construct()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should error if bad get key', async () => {
    const i = await construct({ file: ':memory:' })
    const p = i.nvPersist
    try {
      await p.get('hello')
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should error if bad set key', async () => {
    const i = await construct({ file: ':memory:' })
    const p = i.nvPersist
    try {
      await p.set('hello', Buffer.from('hello'))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should error if bad set data', async () => {
    const i = await construct({ file: ':memory:' })
    const p = i.nvPersist
    try {
      await p.set(Buffer.from('hello'), 'hello')
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should save and get', async () => {
    const hash = crypto.randomBytes(32)
    const i = await construct({ file: ':memory:' })
    const p = i.nvPersist
    await p.set(NS, hash, Buffer.from('this is a test'))
    expect((await p.get(NS, hash)).toString()).equals('this is a test')
    i.destroy()
  })

  it('should get null', async () => {
    const i = await construct({ file: ':memory:' })
    const p = i.nvPersist
    expect((await p.get(NS, Buffer.from('hello')))).equals(null)
    i.destroy()
  })

  it('should save multi and get', async () => {
    const hash = crypto.randomBytes(32)
    const i = await construct({ file: ':memory:' })
    const p = i.nvPersist
    await p.set(NS, hash, Buffer.from('this is a test'))
    await p.set(NS, hash, Buffer.from('this is a test2'))
    expect((await p.get(NS, hash)).toString()).equals('this is a test2')
    i.destroy()
  })
})
