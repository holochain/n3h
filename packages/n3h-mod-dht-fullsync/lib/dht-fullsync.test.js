const { expect } = require('chai')

const { Dht } = require('@holochain/n3h-mod-spec')
const { DhtBackendFullsync } = require('./index')

describe('DhtBackendFullsync Suite', () => {
  let d = null

  beforeEach(async () => {
    d = await new Dht(DhtBackendFullsync, {
    })
  })

  afterEach(async () => {
    await d.destroy()
  })

  it('tmp', async () => {
    expect(true).equals(true)
  })
})
