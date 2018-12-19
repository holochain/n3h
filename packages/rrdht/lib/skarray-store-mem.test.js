const { expect } = require('chai')
const { SKArrayStoreMem } = require('./skarray-store-mem')

describe('skarray-store-mem Suite', () => {
  let store = null

  beforeEach(async () => {
    store = await new SKArrayStoreMem()

    // await separately, to make sure they go in this order
    // for testing, normally, you should await Promise.all([]) these
    await store.insert(3, '3:a')
    await store.insert(-1, '-1:a')
    await store.insert(5, '5:a')
    await store.insert(4, '4:a')
    await store.insert(3, '3:b')
  })

  it('should sort locs', async () => {
    expect(await store.keys()).deep.equals([
      -1,
      3,
      4,
      5
    ])
  })

  it('should get hashes -1', async () => {
    expect(Array.from(await store.get(-1))).deep.equals([
      '-1:a'
    ])
  })

  it('should get hashes 2', async () => {
    expect(Array.from(await store.get(2))).deep.equals([])
  })

  it('should get hashes 3', async () => {
    expect(Array.from(await store.get(3))).deep.equals([
      '3:a',
      '3:b'
    ])
  })

  it('should output hashSet from default', async () => {
    const res = await store.getHashList()
    expect(res.startLoc).equals(0)
    expect(res.endLoc).equals(-1)
    expect(Array.from(res.hashSet.values())).deep.equals([
      '3:a',
      '3:b',
      '4:a',
      '5:a',
      '-1:a'
    ])
  })

  it('should output hashSet from -1', async () => {
    const res = await store.getHashList(-1)
    expect(res.startLoc).equals(-1)
    expect(res.endLoc).equals(5)
    expect(Array.from(res.hashSet.values())).deep.equals([
      '-1:a',
      '3:a',
      '3:b',
      '4:a',
      '5:a'
    ])
  })

  it('should output hashSet from 4', async () => {
    const res = await store.getHashList(4)
    expect(res.startLoc).equals(4)
    expect(res.endLoc).equals(3)
    expect(Array.from(res.hashSet.values())).deep.equals([
      '4:a',
      '5:a',
      '-1:a',
      '3:a',
      '3:b'
    ])
  })

  it('should limit hashes', async () => {
    const res = await store.getHashList(-1, 1)
    expect(res.startLoc).equals(-1)
    expect(res.endLoc).equals(-1)
    expect(Array.from(res.hashSet.values())).deep.equals([
      '-1:a'
    ])
  })

  it('should remove', async () => {
    await Promise.all([
      store.remove(3, '3:a'),
      store.remove(4, '4:a'),
      store.remove(5, 'fake-hash')
    ])
    expect(await store.keys()).deep.equals([
      -1,
      3,
      5
    ])
    expect(Array.from((await store.getHashList()).hashSet.values())).deep.equals([
      '3:b',
      '5:a',
      '-1:a'
    ])
  })
})
