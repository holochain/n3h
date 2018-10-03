const { Sqlite3Backend } = require('./sqlite3backend')
const { expect } = require('chai')
const crypto = require('crypto')

describe('Sqlite3Backend Suite', () => {
  it('should be a function', () => {
    expect(typeof Sqlite3Backend).equals('function')
  })

  it('should save and get', async () => {
    const hash = crypto.randomBytes(32).toString('base64')
    const i = await Sqlite3Backend.connect({ file: ':memory:' })
    await i.set(hash, 'this is a test')
    expect(await i.get(hash)).equals('this is a test')
  })

  it('should save multi and get', async () => {
    const hash = crypto.randomBytes(32).toString('base64')
    const i = await Sqlite3Backend.connect({ file: ':memory:' })
    await i.set(hash, 'this is a test')
    await i.set(hash, 'this is a test2')
    expect(await i.get(hash)).equals('this is a test2')
  })
})
