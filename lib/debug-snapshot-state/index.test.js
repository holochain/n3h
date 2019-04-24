// const { expect } = require('chai')

const { DebugSnapshotState } = require('./index')

describe('DebugSnapshotState DB Suite', () => {
  it('sanity', async () => {
    const state = await new DebugSnapshotState(':memory:')

    state.insert({
      'aoeu': { test: 'hello' },
      ';qjk': { test: 'hello2' }
    }, 'test', { test: 'hello3' })

    state.insert({
      'aoeu': { test: 'hello' },
      'eudi': { test: 'hello4' }
    }, 'test', { test: 'hello5' })

    console.log(JSON.stringify(state.dump(), null, 2))

    await state.destroy()
  })
})
