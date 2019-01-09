const { expect } = require('chai')
const { SKArrayStoreMem } = require('./skarray-store-mem')

describe('skarray-store-mem Suite', () => {
  let store = null

  beforeEach(async () => {
    store = await new SKArrayStoreMem()

    // await separately, to make sure they go in this order
    // for testing, normally, you should await Promise.all([]) these
    await store.insert('00000003', '3:a')
    await store.insert('00000002', '2:a')
    await store.insert('ffffffff', 'f:a')
    await store.insert('00000005', '5:a')
    await store.insert('00000004', '4:a')
    await store.insert('00000003', '3:b')
  })

  it('should sort locs', async () => {
    expect(await store.keys()).deep.equals([
      '00000002',
      '00000003',
      '00000004',
      '00000005',
      'ffffffff'
    ])
  })

  it('should get hashes f', async () => {
    expect(Array.from(await store.get('ffffffff'))).deep.equals([
      'f:a'
    ])
  })

  it('should get hashes 1', async () => {
    expect(Array.from(await store.get('00000001'))).deep.equals([])
  })

  it('should get hashes 3', async () => {
    expect(Array.from(await store.get('00000003'))).deep.equals([
      '3:a',
      '3:b'
    ])
  })

  it('should output hashSet from default', async () => {
    const res = await store.getHashList('00000000', 'ffffffff')
    expect(res.startLoc).equals('00000000')
    expect(res.endLoc).equals('ffffffff')
    expect(Array.from(res.hashSet.values())).deep.equals([
      '2:a',
      '3:a',
      '3:b',
      '4:a',
      '5:a',
      'f:a'
    ])
  })

  it('should output hashSet from f', async () => {
    const res = await store.getHashList('ffffffff', 'ffffffff')
    expect(res.startLoc).equals('ffffffff')
    expect(res.endLoc).equals('00000005')
    expect(Array.from(res.hashSet.values())).deep.equals([
      'f:a',
      '2:a',
      '3:a',
      '3:b',
      '4:a',
      '5:a'
    ])
  })

  it('should output hashSet from 4', async () => {
    const res = await store.getHashList('00000004', '00000004')
    expect(res.startLoc).equals('00000004')
    expect(res.endLoc).equals('00000003')
    expect(Array.from(res.hashSet.values())).deep.equals([
      '4:a',
      '5:a',
      'f:a',
      '2:a',
      '3:a',
      '3:b'
    ])
  })

  it('should limit hashes', async () => {
    const res = await store.getHashList('ffffffff', 'ffffffff', 1)
    expect(res.startLoc).equals('ffffffff')
    expect(res.endLoc).equals('ffffffff')
    expect(Array.from(res.hashSet.values())).deep.equals([
      'f:a'
    ])
  })

  it('should remove', async () => {
    await Promise.all([
      store.remove('00000003', '3:a'),
      store.remove('00000004', '4:a'),
      store.remove('00000005', 'fake-hash')
    ])
    expect(await store.keys()).deep.equals([
      '00000002',
      '00000003',
      '00000005',
      'ffffffff'
    ])
    expect(Array.from((await store.getHashList('00000000', 'ffffffff')).hashSet.values())).deep.equals([
      '2:a',
      '3:b',
      '5:a',
      'f:a'
    ])
  })
})
