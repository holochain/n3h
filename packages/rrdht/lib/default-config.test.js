const { expect } = require('chai')
const mosodium = require('@holochain/mosodium')
const conf = require('./default-config')

const TEST_HASH = 'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg='
const TEST_NONCE = 'b+OXWcbfUO/eq3wmPk/RYjUWheTC/V/t+EqfIaUDJvU='
const TEST_DATA = Buffer.from('test').toString('base64')

describe('defaultConfig Suite', () => {
  let defTgt

  beforeEach(() => {
    mosodium.SecBuf.setLockLevel(mosodium.SecBuf.LOCK_NONE)
    defTgt = conf.agentLocWorkTarget
  })

  afterEach(() => {
    conf.debugAgentLocSearchStartNonce = null
    conf.agentLocWorkTarget = defTgt
  })

  it('bad buf throws', async () => {
    try {
      await conf.hashFn(conf, 42)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('bad buf len throws', async () => {
    try {
      await conf.dataLocFn(conf, Buffer.alloc(2).toString('base64'))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('hashFn', async () => {
    expect((await conf.hashFn(conf, TEST_DATA)))
      .equals('n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=')
  })

  it('dataLocFn', async () => {
    expect((await conf.dataLocFn(conf,
      await conf.hashFn(conf, TEST_DATA))))
      .equals('oaY8ew==')
  })

  it('agentLocSearchFn', async () => {
    conf.debugAgentLocSearchStartNonce = Buffer.from('6ee39759c6df50efdeab7c263e4fd162351685e4c2fd5fedf84a9f21a50326f5', 'hex').toString('base64')
    const nonce = await conf.agentLocSearchFn(conf, TEST_HASH)
    expect(nonce).equals(TEST_NONCE)
  })

  it('agentLocSearchFn easy', async () => {
    conf.agentLocWorkTarget = Buffer.from('00000000000000000000000000000000000000000000000000000000000000ff', 'hex').toString('base64')
    await conf.agentLocSearchFn(conf, TEST_HASH)
  })

  it('agentLocFn', async () => {
    const loc = await conf.agentLocFn(conf, TEST_HASH, TEST_NONCE)
    expect(loc).equals('oaY8ew==')
  })

  it('cache set and get', async () => {
    await conf.persistCacheSet(conf, 'testNs', 'testKey', 'testVal')
    expect(await conf.persistCacheGet(conf, 'testNs', 'testKey')).equals('testVal')
  })
})
