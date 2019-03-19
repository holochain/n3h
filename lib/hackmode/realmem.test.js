const { expect } = require('chai')

const RealMem = require('./realmem').RealMem

describe('HackMode Mem Suite', () => {
  let m

  beforeEach(() => {
    m = new RealMem()
    m.insert({
      address: 'test1'
    })
    m.insert({
      address: 'test2'
    })
  })

  it('should be a function', () => {
    expect(typeof RealMem).equals('function')
  })

  it('should get', () => {
    expect(m.get('test1')).deep.equals({
      entry: {
        address: 'test1'
      },
      meta: []
    })
  })
})
