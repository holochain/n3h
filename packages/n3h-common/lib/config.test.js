const { expect } = require('chai')
const { config } = require('./index')

const testDef = {
  testString: config.entry({
    type: 'string',
    default: 'testValue'
  }),
  testStringArray: config.entry({
    type: 'arrayOf.string',
    default: []
  }),
  testNumber: config.entry({
    type: 'number',
    default: 42
  }),
  testReq: config.entry({
    type: 'number'
  }),
  groupName: {
    testString: config.entry({
      type: 'string',
      default: 'testValue'
    })
  }
}

describe('config Suite', () => {
  let c = null

  beforeEach(() => {
    c = config.createDefinition(testDef)
  })

  afterEach(() => {
    c = null
  })

  it('can load default', () => {
    const tmp = c({})
    expect(tmp).deep.equals({
      extend: tmp.extend,
      testString: 'testValue',
      testStringArray: [],
      testNumber: 42,
      testReq: null,
      groupName: {
        testString: 'testValue'
      }
    })
  })

  it('can load values', () => {
    const tmp = c({
      testString: 'newVal1',
      testStringArray: ['a1', 'a2'],
      testNumber: 101,
      testReq: 202,
      groupName: {
        testString: 'newVal2'
      }
    })
    expect(tmp).deep.equals({
      extend: tmp.extend,
      testString: 'newVal1',
      testStringArray: ['a1', 'a2'],
      testNumber: 101,
      testReq: 202,
      groupName: {
        testString: 'newVal2'
      }
    })
  })
})
