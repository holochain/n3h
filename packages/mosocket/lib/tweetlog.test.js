const expect = require('chai').expect
const sinon = require('sinon')

sinon.spy(console, 'log')
sinon.spy(console, 'error')

const logger = require('./tweetlog')

describe('tweetlog Suite', () => {
  beforeEach(() => {
    logger.clear()
  })

  afterEach(() => {
    sinon.reset()
  })

  after(() => {
    sinon.restore()
  })

  it('should log error', () => {
    logger.set('e')
    const s = sinon.stub()
    logger.listen(s)
    logger('test').e('test')
    expect(s.calledWith('e', 'test', 'test')).equals(true)
  })

  it('should not log warn', () => {
    logger.set('e')
    const s = sinon.stub()
    logger.listen(s)
    logger('test').w('test')
    expect(s.callCount).equals(0)
  })

  it('should log warn', () => {
    logger.set('w')
    const s = sinon.stub()
    logger.listen(s)
    logger('test').w('test')
    expect(s.calledWith('w', 'test', 'test')).equals(true)
  })

  it('should not log info', () => {
    logger.set('w')
    const s = sinon.stub()
    logger.listen(s)
    logger('test').i('test')
    expect(s.callCount).equals(0)
  })

  it('should log info', () => {
    logger.set('i')
    const s = sinon.stub()
    logger.listen(s)
    logger('test').i('test')
    expect(s.calledWith('i', 'test', 'test')).equals(true)
  })

  it('should not log debug', () => {
    logger.set('i')
    const s = sinon.stub()
    logger.listen(s)
    logger('test').d('test')
    expect(s.callCount).equals(0)
  })

  it('should log debug', () => {
    logger.set('d')
    const s = sinon.stub()
    logger.listen(s)
    logger('test').d('test')
    expect(s.calledWith('d', 'test', 'test')).equals(true)
  })

  it('should not log trace', () => {
    logger.set('d')
    const s = sinon.stub()
    logger.listen(s)
    logger('test').t('test')
    expect(s.callCount).equals(0)
  })

  it('should log trace', () => {
    logger.set('t')
    const s = sinon.stub()
    logger.listen(s)
    logger('test').t('test')
    expect(s.calledWith('t', 'test', 'test')).equals(true)
  })

  it('should output to console.error', () => {
    logger.listen(logger.console)
    logger('test').e('test')
    expect(console.error.calledWith('(test) [e] test')).equals(true)
  })

  it('should output to console.log', () => {
    logger.listen(logger.console)
    logger('test').i('test')
    expect(console.log.calledWith('(test) [i] test')).equals(true)
  })
})
