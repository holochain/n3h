const expect = require('chai').expect

const message = require('./message')

describe('message Suite', () => {
  it('should be an object', () => {
    expect(typeof message).equals('object')
  })

  it('gen/parse noticeReliable', () => {
    const result = message.parse(message.newNoticeReliable(
      1, 'test', Buffer.from([1])))
    expect(result.type).equals(message.MsgType.noticeReliable)
    expect(result.protoHash).equals(1)
    expect(result.hookName).equals('test')
    expect(result.data.toString('base64')).equals('AQ==')
  })
})
