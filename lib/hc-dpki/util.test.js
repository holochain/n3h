const util = require('./util')

const { expect } = require('chai')

const PAIRS = [
  [
    'bKtQZ0K4p6I08mMFg97ocVcya89d7BZemNwAJ+aRtI8=',
    'UaGPwrJ7lo1fn7tMe8igLvpquZX9zI1JJ598jQ7qCnw=',
    'HcSCI5fMkbUvfpfhvi4qezZFRqQpr6kygJw68YQNC3Qjsyaae9uJDoeqry6nmbi'
  ],
  [
    'HpFSKV7BFubAAngGQAsMqsR2tS7BlL4uNER2fAPpV0A=',
    'StDO3pWmTLx+jyC5mB1ppVflxOjrE/VfIpR1ySI75VU=',
    'HcSCIHvSKIVw7rix65Aae8AGIAfr3kxep44t7RnVyZYDisdxqrB8tW4AT8Oqkva'
  ],
  [
    'bSUsrgQ9e7Cm3m36/Fydje1n6Lk8iiaBV37TCXv1hGM=',
    'vP3tFexNbkV95SvZq7tpuHS3jN4NwdKV8yC1CoeUzkQ=',
    'HcScI5jfFTyaiqm5xcUO65Q49SpJ5dQon9vMTQEKE4awp9xuBf79MBdDKAjhz8i'
  ],
  [
    '2dUi/d4POxdoIBj9x1yZIWb+vmZqZXBJooYgj6X8PZo=',
    'xJvjFPtUlrd/pKB8nMzwSrxU2tmMSwga40/fPH0IiOk=',
    'HcSCjXpWEM876D35c7VCaGH7Z7pJtimg949gN4ufpbE4fbsaS8t9ZqN44Zmay7a'
  ],
  [
    'AcNVXMRSlZC3j/2JwNa9VCJ7Ex3k6bfnJPxktXtBPXs=',
    'CXVlSZUAxkMq21qOZ/HP59w1EZzWYeaWO3odtWjqHQ8=',
    'HcSCIApdKWpnivvwtc5z99njzdMM4wbcqnJs53hJX9utj9dexW7vcqm5hWfhc9z'
  ]
]

describe('util Suite', () => {
  for (let i = 0; i < PAIRS.length; ++i) {
    it('encode & decode keypair ' + i, () => {
      const s = Buffer.from(PAIRS[i][0], 'base64')
      const e = Buffer.from(PAIRS[i][1], 'base64')

      const signPubId = util.encodeSign(s)
      const encPubId = util.encodeEnc(e)

      expect(signPubId).equals(PAIRS[i][2])

      const signPub = util.decodeSign(signPubId)
      const encPub = util.decodeEnc(encPubId)
      expect(signPub.toString('base64')).equals(PAIRS[i][0])
      expect(encPub.toString('base64')).equals(PAIRS[i][1])
    })

    it('encode & decode corrupted keypair ' + i, () => {
      const s = Buffer.from(PAIRS[i][0], 'base64')
      const e = Buffer.from(PAIRS[i][1], 'base64')

      let signPubId = util.encodeSign(s)
      let encPubId = util.encodeEnc(e)
      expect(signPubId).equals(PAIRS[i][2])

      signPubId = `${signPubId.substr(0, 10)}AAA${signPubId.substr(13)}`
      encPubId = `${encPubId.substr(0, 10)}AAA${encPubId.substr(13)}`

      const signPub = util.decodeSign(signPubId)
      const encPub = util.decodeEnc(encPubId)
      expect(signPub.toString('base64')).equals(PAIRS[i][0])
      expect(encPub.toString('base64')).equals(PAIRS[i][1])
    })
  }
})
