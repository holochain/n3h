const { expect } = require('chai')

const { getDebugSnapshot } = require('../debug-snapshot')
const lib = require('./realmode')

describe('RealMode Suite', () => {
  it('should be a function', () => {
    expect(typeof lib.N3hRealMode).equals('function')
  })

  it('should init', async () => {
    let n3hNode = await new lib.N3hRealMode('.')
    console.log('n3hMode nick is', n3hNode.me())
    await n3hNode.destroy()
    getDebugSnapshot().destroy()
  }).timeout(10000)
})
