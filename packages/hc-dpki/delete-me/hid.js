const { Encoder, Decoder } = require('@holochain/n-bch-rs')
const rfc4648 = require('rfc4648')

const PARITY_COUNT = 8
const PREFIX = Buffer.from('389424', 'hex')
const CAP_MAGIC = '101'

const rsEncoder = new Encoder(PARITY_COUNT)
const rsDecoder = new Decoder(PARITY_COUNT)

function _rawEncodeBase32 (buf) {
  return rfc4648.codec.stringify(buf, {
    chars: 'ABCDEFGHIJKMNOPQRSTUVWXYZ3456789',
    bits: 5
  }).replace(/=/g, '')
}

function _capEncode (s, bytes) {
  bytes = bytes.readUInt32BE(0).toString(2).padStart(32, '0')

  const out = []

  for (let i = 0; i < CAP_MAGIC.length; ++i) {
    if (CAP_MAGIC[i] === '1') {
      out.push(s[i].toUpperCase())
    } else {
      out.push(s[i].toLowerCase())
    }
  }

  const len = Math.ceil((s.length - CAP_MAGIC.length) / 4)
  for (let seg = 0; seg < 4; ++seg) {
    const segData = bytes.slice(seg * 8, seg * 8 + 8).split('')
    let aCount = 0
    const segOut = []
    for (let i = 0; i < len; ++i) {
      const bIndex = (seg * len) + i
      const c = s[CAP_MAGIC.length + bIndex]
      if (/\d/.test(c)) {
        segOut.push(c)
      } else {
        ++aCount
        segOut.push(segData.shift() === '1' ? c.toUpperCase() : c.toLowerCase())
      }
    }
    if (aCount >= 8) {
      out.push(segOut.join(''))
    } else {
      out.push(segOut.join('').toLowerCase())
    }
  }

  return out.join('')
}

function encodeBase32 (buf) {
  if (!(buf instanceof Buffer)) {
    throw new Error('required Buffer')
  }

  let withParity = rsEncoder.encode(buf)
  const capBytes = withParity.slice(withParity.byteLength - 4)
  withParity = withParity.slice(0, withParity.byteLength - 4)

  const toEnc = Buffer.concat([
    PREFIX,
    withParity
  ])

  const allCaps = _rawEncodeBase32(toEnc)

  return _capEncode(allCaps, capBytes)
}
exports.encodeBase32 = encodeBase32
