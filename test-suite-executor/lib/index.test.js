const { expect } = require('chai')

const { TestSuiteExecutor } = require('./index')

describe('Test Suite Executor Suite', () => {
  it('should be a function', () => {
    expect(typeof TestSuiteExecutor).equals('function')
  })
})
