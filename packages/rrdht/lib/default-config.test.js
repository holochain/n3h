const { expect } = require('chai')
const mosodium = require('@holochain/mosodium')

const defaultConfig = require('./default-config')

const TEST_HASH = 'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg='
const TEST_NONCE = 'b+OXWcbfUO/eq3wmPk/RYjUWheTC/V/t+EqfIaUDJvU='
const TEST_DATA = Buffer.from('test').toString('base64')

describe('defaultConfig Suite', () => {
  let conf = null

  async function initConf (c) {
    c || (c = {})
    if (!('agentHash' in c)) {
      c.agentHash = TEST_HASH
    }
    if (!('agentNonce' in c)) {
      c.agentNonce = TEST_NONCE
    }
    if (!('agentPeerInfo' in c)) {
      c.agentPeerInfo = {}
    }
    conf = await (defaultConfig.generateConfigBuilder()
      .attach(c)
      .finalize())
  }

  beforeEach(async () => {
    mosodium.SecBuf.setLockLevel(mosodium.SecBuf.LOCK_NONE)
    await initConf()
  })

  afterEach(() => {
  })

  it('bad buf throws', async () => {
    try {
      await conf.hashFn(42)
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('bad buf len throws', async () => {
    try {
      await conf.dataLocFn(Buffer.alloc(2).toString('base64'))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('hashFn', async () => {
    expect((await conf.hashFn(TEST_DATA)))
      .equals('n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=')
  })

  it('dataLocFn', async () => {
    expect((await conf.dataLocFn(
      await conf.hashFn(TEST_DATA))))
      .equals('oaY8ew==')
  })

  it('agentLocSearchFn', async () => {
    await initConf({
      debugAgentLocSearchStartNonce: Buffer.from('6ee39759c6df50efdeab7c263e4fd162351685e4c2fd5fedf84a9f21a50326f5', 'hex').toString('base64')
    })
    const nonce = await conf.agentLocSearchFn(TEST_HASH)
    expect(nonce).equals(TEST_NONCE)
  })

  it('agentLocSearchFn easy', async () => {
    await initConf({
      agentLocWorkTarget: Buffer.from('00000000000000000000000000000000000000000000000000000000000000ff', 'hex').toString('base64')
    })
    await conf.agentLocSearchFn(TEST_HASH)
  })

  it('agentLocFn', async () => {
    const loc = await conf.agentLocFn(TEST_HASH, TEST_NONCE)
    expect(loc).equals('oaY8ew==')
  })

  it('cache set and get', async () => {
    const p = await conf.persistCacheProxy('testNs')
    await p.testKey.set('testVal')
    expect(await p.testKey()).equals('testVal')
  })

  it('cache remove', async () => {
    const p = await conf.persistCacheProxy('testNs')
    await Promise.all([
      p.testKey.set('testVal'),
      p.testKey2.set('testVal2')
    ])
    await p.testKey.remove()
    expect(await p.testKey2()).equals('testVal2')
    expect(await p.testKey()).equals(undefined)
  })
})
