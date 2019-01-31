const { expect } = require('chai')
const { createEventSpec } = require('./index')

const TEST_EVENTS = {
  evOne: (a, b) => {
    return { a, b }
  },

  evTwo: (a) => {
    return { type: a }
  }
}

describe('createEventSpec Suite', () => {
  let spec = null

  beforeEach(() => {
    spec = createEventSpec(TEST_EVENTS)
  })

  afterEach(() => {
    spec = null
  })

  it('should produce evOne', () => {
    const evt = spec.evOne('test', 42)
    expect(spec.isEvent(evt)).equals(true)
    expect(evt.a).equals('test')
    expect(evt.b).equals(42)
  })

  it('should throw on bad spec', () => {
    expect(() => {
      createEventSpec({ a: 42 })
    }).throws()
  })

  it('should throw on bad param name', () => {
    expect(() => {
      spec.evTwo('hi')
    }).throws()
  })
})
