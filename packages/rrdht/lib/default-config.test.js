const { expect } = require('chai')
const mosodium = require('@holochain/mosodium')
const conf = require('./default-config')

const TEST_HASH = Buffer.from('n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=', 'base64')
const TEST_NONCE = Buffer.from('b+OXWcbfUO/eq3wmPk/RYjUWheTC/V/t+EqfIaUDJvU=', 'base64')

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

  it('hashFn', async () => {
    expect((await conf.hashFn(conf, Buffer.from('test'))).toString('base64'))
      .equals('n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=')
  })

  it('dataLocFn', async () => {
    expect((await conf.dataLocFn(conf,
      await conf.hashFn(conf, Buffer.from('test')))).toString('base64'))
      .equals('oaY8ew==')
  })

  it('agentLocSearchFn', async () => {
    conf.debugAgentLocSearchStartNonce = Buffer.from('6ee39759c6df50efdeab7c263e4fd162351685e4c2fd5fedf84a9f21a50326f5', 'hex')
    const nonce = await conf.agentLocSearchFn(conf, TEST_HASH)
    expect(nonce.toString('base64')).equals(TEST_NONCE.toString('base64'))
  })

  it('agentLocSearchFn easy', async () => {
    conf.agentLocWorkTarget = Buffer.from('00000000000000000000000000000000000000000000000000000000000000ff', 'hex')
    await conf.agentLocSearchFn(conf, TEST_HASH)
  })

  it('agentLocFn', async () => {
    const loc = await conf.agentLocFn(conf, TEST_HASH, TEST_NONCE)
    expect(loc.toString('base64')).equals('oaY8ew==')
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
      await conf.dataLocFn(conf, Buffer.alloc(2))
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })
})
