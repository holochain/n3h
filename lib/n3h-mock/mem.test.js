const { expect } = require('chai')

const Mem = require('./mem').Mem

describe('Mock Mem Suite', () => {
  let m

  beforeEach(() => {
    m = new Mem()
    m.insert({
      v: 'test1'
    })
    m.insert({
      v: 'test2'
    })
  })

  it('should be a function', () => {
    expect(typeof Mem).equals('function')
  })

  it('should get', () => {
    expect(m.get('OYAEmbRpxTognzO4iFhiaytimxCxgw43Wdj1AJ4XYJo=')).deep.equals({
      v: 'test1'
    })
  })
})
