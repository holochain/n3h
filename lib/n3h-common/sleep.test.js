const { expect } = require('chai')

const { $sleep } = require('./index')

describe('$sleep Suite', () => {
  it('should pause execution', async () => {
    const first = Date.now()
    await $sleep(10)
    const second = Date.now()
    expect(second - first).greaterThan(8)
  })
})
