const { expect } = require('chai')

const RealMem = require('./realmem').RealMem
const getLoc = require('./realmem').getLoc

describe('RealMem Suite', () => {
  let m

  beforeEach(() => {
    m = new RealMem()
    m.insert({
      type: 'entryAspect',
      entryAddress: 'entryAddress1',
      aspectAddress: 'aspectAddress1'
    })
    m.insert({
      type: 'entryAspect',
      entryAddress: 'entryAddress2',
      aspectAddress: 'aspectAddress2'
    })
    m.insert({
      type: 'entryAspect',
      entryAddress: 'entryAddress2',
      aspectAddress: 'aspectAddress3'
    })
  })

  it('should be a function', () => {
    expect(typeof RealMem).equals('function')
  })

  it('should get entryAddress1', () => {
    let e1 = m.get('entryAddress1')
    expect(e1).deep.equals([{
      aspectAddress: 'aspectAddress1',
      json: JSON.stringify({
        type: 'entryAspect',
        entryAddress: 'entryAddress1',
        aspectAddress: 'aspectAddress1'
      })
    }])
  })

  it('should get entryAddress2', () => {
    let e1 = m.get('entryAddress2')
    expect(e1).deep.equals([{
      aspectAddress: 'aspectAddress2',
      json: JSON.stringify({
        type: 'entryAspect',
        entryAddress: 'entryAddress2',
        aspectAddress: 'aspectAddress2'
      })
    }, {
      aspectAddress: 'aspectAddress3',
      json: JSON.stringify({
        type: 'entryAspect',
        entryAddress: 'entryAddress2',
        aspectAddress: 'aspectAddress3'
      })
    }
    ])
  })

  it('should have all entryAddress', () => {
    expect(m.has('entryAddress1', 'aspectAddress1')).equals(true)
    expect(m.has('entryAddress2', 'aspectAddress1')).equals(false)
    expect(m.has('entryAddress2', 'aspectAddress2')).equals(true)
    expect(m.has('entryAddress2', 'aspectAddress3')).equals(true)
    expect(m.has('entryAddress1', 'aspectAddress2')).equals(false)
  })

  it('should get aspect', () => {
    let aspect = m.getAspect('entryAddress1', 'aspectAddress1')
    expect(aspect).deep.equals({
      type: 'entryAspect',
      entryAddress: 'entryAddress1',
      aspectAddress: 'aspectAddress1'
    })
  })

  it('should get aspect 2', () => {
    let aspect = m.getAspect('entryAddress2', 'aspectAddress2')
    expect(aspect).deep.equals({
      type: 'entryAspect',
      entryAddress: 'entryAddress2',
      aspectAddress: 'aspectAddress2'
    })
    aspect = m.getAspect('entryAddress2', 'aspectAddress3')
    expect(aspect).deep.equals({
      type: 'entryAspect',
      entryAddress: 'entryAddress2',
      aspectAddress: 'aspectAddress3'
    })
  })

  it('should not insert duplicate', () => {
    expect(m.insert({
      type: 'entryAspect',
      entryAddress: 'entryAddress1',
      aspectAddress: 'aspectAddress1'
    })).equals(false)
  })

  it('should update', () => {
    m.insert({
      type: 'entryAspect',
      entryAddress: 'entryAddress4',
      aspectAddress: 'aspectAddress4',
      version: 1
    })
    let aspect4V1 = m.getAspect('entryAddress4', 'aspectAddress4')
    let locHashV1 = m._locHashes[getLoc('entryAddress4')]
    expect(m.insert({
      type: 'entryAspect',
      entryAddress: 'entryAddress4',
      aspectAddress: 'aspectAddress4',
      version: 2
    })).equals(true)
    let locHashV2 = m._locHashes[getLoc('entryAddress4')]
    let aspect4V2 = m.getAspect('entryAddress4', 'aspectAddress4')
    expect(locHashV2).not.equal(locHashV1)
    expect(aspect4V2).not.equal(aspect4V1)
  })
})
