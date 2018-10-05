const { Sqlite3Backend } = require('./sqlite3backend')
const { expect } = require('chai')
const crypto = require('crypto')

const NS = 'test'

describe('Sqlite3Backend Suite', () => {
  it('should be a function', () => {
    expect(typeof Sqlite3Backend).equals('function')
  })

  it('should error with no config', async () => {
    try {
      await new Sqlite3Backend()
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should save and get', async () => {
    const hash = crypto.randomBytes(32).toString('base64')
    const i = await new Sqlite3Backend({ file: ':memory:' })
    await i.set(NS, hash, Buffer.from('this is a test'))
    expect((await i.get(NS, hash)).toString()).equals('this is a test')
  })

  it('should save multi and get', async () => {
    const hash = crypto.randomBytes(32).toString('base64')
    const i = await new Sqlite3Backend({ file: ':memory:' })
    await i.set(NS, hash, Buffer.from('this is a test'))
    await i.set(NS, hash, Buffer.from('this is a test2'))
    expect((await i.get(NS, hash)).toString()).equals('this is a test2')
  })
})
