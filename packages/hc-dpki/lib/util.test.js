const util = require('./util')

const { expect } = require('chai')

const PAIRS = [
  [
    'bKtQZ0K4p6I08mMFg97ocVcya89d7BZemNwAJ+aRtI8=',
    'UaGPwrJ7lo1fn7tMe8igLvpquZX9zI1JJ598jQ7qCnw=',
    'HkeyVHSsHUxVG15yiiMNRgrSWWLE1GKB2bo8QPrdHiW3nHY14mDSMAiz1HUNkgiDgJMQEdo39hEj38UNzV6TW13fkwLsemWFLNwtMq'
  ]/*,
  [
    'HpFSKV7BFubAAngGQAsMqsR2tS7BlL4uNER2fAPpV0A=',
    'StDO3pWmTLx+jyC5mB1ppVflxOjrE/VfIpR1ySI75VU=',
    ''
  ],
  [
    'bSUsrgQ9e7Cm3m36/Fydje1n6Lk8iiaBV37TCXv1hGM=',
    'vP3tFexNbkV95SvZq7tpuHS3jN4NwdKV8yC1CoeUzkQ=',
    ''
  ],
  [
    '2dUi/d4POxdoIBj9x1yZIWb+vmZqZXBJooYgj6X8PZo=',
    'xJvjFPtUlrd/pKB8nMzwSrxU2tmMSwga40/fPH0IiOk=',
    ''
  ],
  [
    'AcNVXMRSlZC3j/2JwNa9VCJ7Ex3k6bfnJPxktXtBPXs=',
    'CXVlSZUAxkMq21qOZ/HP59w1EZzWYeaWO3odtWjqHQ8=',
    ''
  ]*/
]

describe('util Suite', () => {
  for (let i = 0; i < PAIRS.length; ++i) {
    it('encode & parse pair ' + i, () => {
      const s = Buffer.from(PAIRS[i][0], 'base64')
      const e = Buffer.from(PAIRS[i][1], 'base64')

      const key = util.encodeId(s, e)
      expect(key).equals(PAIRS[i][2])

      const { signPub, encPub } = util.decodeId(key)
      expect(signPub.toString('base64')).equals(PAIRS[i][0])
      expect(encPub.toString('base64')).equals(PAIRS[i][1])
    })

    it('encode & corrupt pair ' + i, () => {
      const s = Buffer.from(PAIRS[i][0], 'base64')
      const e = Buffer.from(PAIRS[i][1], 'base64')

      let key = util.encodeId(s, e)
      expect(key).equals(PAIRS[i][2])

      console.log('correct', key)
      key = `${key.substr(0, 10)}AAA${key.substr(13)}`
      console.log('corrupt', key)

      const { signPub, encPub } = util.decodeId(key)
      expect(signPub.toString('base64')).equals(PAIRS[i][0])
      expect(encPub.toString('base64')).equals(PAIRS[i][1])
    })
  }
})
