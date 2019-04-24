const { expect } = require('chai')

const { DebugSnapshotState } = require('./index')

describe('DebugSnapshotState DB Suite', () => {
  it('sanity', () => {
    const state = new DebugSnapshotState(':memory:')

    state.insert({
      'hash1': { test: 'hello' },
      'hash2': { test: 'hello2' }
    }, 'test', { test: 'hello3', $cas$_bob: 'hash1' })

    state.insert({
      'hash1': { test: 'hello' },
      'hash3': { test: 'hello4' }
    }, 'test', { test: 'hello5', $cas$_ned: 'hash3', $cas$_fred: 'hash341' })

    const res = state.dump()

    expect(res).contains('[not found] hash341')
    expect(res).contains('"$cas$_bob": {')

    state.destroy()
  })
})
