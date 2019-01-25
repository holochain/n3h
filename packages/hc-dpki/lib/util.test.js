const util = require('./util')

const { expect } = require('chai')

const PAIRS = [
  [
    'bKtQZ0K4p6I08mMFg97ocVcya89d7BZemNwAJ+aRtI8=',
    'UaGPwrJ7lo1fn7tMe8igLvpquZX9zI1JJ598jQ7qCnw=',
    'hkZsq1BnQrinojTyYwWD3uhxVzJrz13sFl6Y3AAn5pG0j1Ghj8Kye5aNX5-7THvIoC76armV_cyNSSeffI0O6gp8WYxE1vI-'
  ],
  [
    'HpFSKV7BFubAAngGQAsMqsR2tS7BlL4uNER2fAPpV0A=',
    'StDO3pWmTLx+jyC5mB1ppVflxOjrE/VfIpR1ySI75VU=',
    'hkYekVIpXsEW5sACeAZACwyqxHa1LsGUvi40RHZ8A-lXQErQzt6Vpky8fo8guZgdaaVX5cTo6xP1XyKUdckiO-VVvUOqFjLW'
  ],
  [
    'bSUsrgQ9e7Cm3m36/Fydje1n6Lk8iiaBV37TCXv1hGM=',
    'vP3tFexNbkV95SvZq7tpuHS3jN4NwdKV8yC1CoeUzkQ=',
    'hkZtJSyuBD17sKbebfr8XJ2N7WfouTyKJoFXftMJe_WEY7z97RXsTW5FfeUr2au7abh0t4zeDcHSlfMgtQqHlM5Ep84vLh42'
  ],
  [
    '2dUi/d4POxdoIBj9x1yZIWb+vmZqZXBJooYgj6X8PZo=',
    'xJvjFPtUlrd/pKB8nMzwSrxU2tmMSwga40/fPH0IiOk=',
    'hkbZ1SL93g87F2ggGP3HXJkhZv6-ZmplcEmihiCPpfw9msSb4xT7VJa3f6SgfJzM8Eq8VNrZjEsIGuNP3zx9CIjpkgufielr'
  ],
  [
    'AcNVXMRSlZC3j/2JwNa9VCJ7Ex3k6bfnJPxktXtBPXs=',
    'CXVlSZUAxkMq21qOZ/HP59w1EZzWYeaWO3odtWjqHQ8=',
    'hkYBw1VcxFKVkLeP_YnA1r1UInsTHeTpt-ck_GS1e0E9ewl1ZUmVAMZDKttajmfxz-fcNRGc1mHmljt6HbVo6h0PVsHwg0g5'
  ]
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

      key = `${key.substr(0, 10)}AAA${key.substr(13)}`

      const { signPub, encPub } = util.decodeId(key)
      expect(signPub.toString('base64')).equals(PAIRS[i][0])
      expect(encPub.toString('base64')).equals(PAIRS[i][1])
    })
  }
})
