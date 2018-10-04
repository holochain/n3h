const sqlite3 = require('./sqlite3')
const { expect } = require('chai')

describe('Sqlite3 promise wrapper Suite', () => {
  it('should be a function', () => {
    expect(typeof sqlite3.Db).equals('function')
  })

  it('should connect and close', async () => {
    const i = await sqlite3.Db.connect(':memory:')
    await i.close()
  })

  it('should connect and close, twice ok', async () => {
    const i = await sqlite3.Db.connect(':memory:')
    await i.close()
    await i.close()
  })

  it('should error on destroyed usage', async () => {
    const i = await sqlite3.Db.connect(':memory:')
    await i.close()
    try {
      await i.prepare('SELECT * FROM life;')
    } catch (e) {
      return
    }
    throw new Error('expected exception, but got success')
  })

  it('should run and get', async () => {
    const i = await sqlite3.Db.connect(':memory:')
    await i.run('CREATE TABLE test (data TEXT)')
    await i.run('INSERT INTO test VALUES (?)', 'hello')
    const res = await i.get('SELECT data FROM test LIMIT 1')
    expect(res.data).equals('hello')
    await i.close()
  })

  it('should all', async () => {
    const i = await sqlite3.Db.connect(':memory:')
    await i.run('CREATE TABLE test (data TEXT)')
    await i.run('INSERT INTO test VALUES (?)', 'hello1')
    await i.run('INSERT INTO test VALUES (?)', 'hello2')
    const res = await i.all('SELECT data FROM test')
    expect(res).deep.equals([
      { 'data': 'hello1' },
      { 'data': 'hello2' }
    ])
    await i.close()
  })

  it('should prepare', async () => {
    const i = await sqlite3.Db.connect(':memory:')
    await i.run('CREATE TABLE test (data TEXT)')
    const s = await i.prepare('INSERT INTO test VALUES (?)')
    await s.run('hello1')
    await s.run('hello2')
    await s.finalize()
    const res = await i.all('SELECT data FROM test')
    expect(res).deep.equals([
      { 'data': 'hello1' },
      { 'data': 'hello2' }
    ])
    await i.close()
  })
})
