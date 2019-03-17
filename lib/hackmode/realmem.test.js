const { expect } = require('chai')

const Mem = require('./realmem').Mem

describe('HackMode Mem Suite', () => {
  let m

  beforeEach(() => {
    m = new Mem()
    m.insert({
      address: 'test1'
    })
    m.insert({
      address: 'test2'
    })
  })

  it('should be a function', () => {
    expect(typeof Mem).equals('function')
  })

  it('should json', () => {
    expect(JSON.stringify(m)).equals('{"test1":{"entry":{"address":"test1"},"meta":[]},"test2":{"entry":{"address":"test2"},"meta":[]}}')
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
