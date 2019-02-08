const { Encoder, Decoder } = require('@holochain/n-bch-rs')
const rfc4648 = require('rfc4648')

const RE_IS_B32_CANNON = /^[ABCDEFGHIJKMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz3456789]+$/
const RE_IS_B32_CAP = /^[ABCDEFGHIJKMNOPQRSTUVWXYZ3456789]+$/
const RE_IS_ALPHA = /^[a-zA-Z]{1}$/
const RE_IS_ALPHA_UP = /^[A-Z]{1}$/
const RE_IS_ALPHA_LO = /^[a-z]{1}$/
const RE_IS_BIN = /^[01]+$/

const rfc4648spec = {
  chars: 'ABCDEFGHIJKMNOPQRSTUVWXYZ3456789',
  bits: 5
}

/**
 */
function _rawEncodeBase32 (buf) {
  return rfc4648.codec.stringify(buf, rfc4648spec).replace(/=/g, '')
}

/**
 */
function _rawDecodeBase32 (str) {
  return Buffer.from(rfc4648.codec.parse(str.toUpperCase(), rfc4648spec, {
    loose: true
  }))
}

/**
 */
class HoloBase32 {
  constructor (opt) {
    if (
      typeof opt !== 'object' ||
      typeof opt.keyByteCount !== 'number' ||
      typeof opt.keyParityByteCount !== 'number' ||
      typeof opt.capParityByteCount !== 'number' ||
      !(opt.prefix instanceof Buffer) ||
      typeof opt.prefixCap !== 'string' ||
      !RE_IS_BIN.test(opt.prefixCap) ||
      typeof opt.segmentLen !== 'number'
    ) {
      throw new Error('bad constructor arg')
    }
    this._keyByteCount = opt.keyByteCount

    this._keyParityByteCount = opt.keyParityByteCount
    this._capParityByteCount = opt.capParityByteCount
    this._totalParityByteCount =
      this._keyParityByteCount + this._capParityByteCount
    this._rsEncoder = new Encoder(this._totalParityByteCount)
    this._rsDecoder = new Decoder(this._totalParityByteCount)

    this._prefix = Buffer.from(opt.prefix)
    this._prefixCap = opt.prefixCap
    this._segmentLen = opt.segmentLen
  }

  /**
   */
  encode (buffer) {
    if (
      !(buffer instanceof Buffer) ||
      buffer.byteLength !== this._keyByteCount
    ) {
      throw new Error(
        'buffer must be a Buffer of byteLength ' + this._keyByteCount)
    }

    const fullParity = this._rsEncoder.encode(buffer)
    const capBytes = fullParity.slice(
      fullParity.byteLength - this._capParityByteCount)

    const keyParity = fullParity.slice(
      0, fullParity.byteLength - this._capParityByteCount)

    const toEnc = Buffer.concat([
      this._prefix,
      keyParity
    ])

    const allCaps = _rawEncodeBase32(toEnc)

    return this._capEncode(allCaps, capBytes)
  }

  /**
   */
  decode (str) {
    const charErasures = []
    const trueErasures = []

    let tmp = this._b32Correct(str, charErasures)

    const capParity = this._capDecode(tmp, charErasures, trueErasures)

    const bytes = _rawDecodeBase32(tmp)

    const toDecode = Buffer.concat([
      bytes.slice(this._prefix.byteLength),
      Buffer.from(capParity)
    ])

    return this._rsDecoder.correct(
      toDecode, Buffer.from(trueErasures)).slice(0, this._keyByteCount)
  }

  // -- private -- //

  /**
   */
  _capEncode (allCaps, capBytes) {
    const out = []

    // first do the prefix
    out.push(this._capEncodeBin(
      allCaps.slice(0, this._prefixCap.length),
      this._prefixCap,
      this._prefixCap.length))

    // now split up the remaining chars
    const binParts = []
    for (let i = 0; i < capBytes.byteLength; ++i) {
      binParts.push(capBytes[i].toString(2).padStart(8, '0'))
    }
    const charParts = allCaps.slice(this._prefixCap.length).match(
      new RegExp('.{' + this._segmentLen + '}', 'g'))

    for (let i = 0; i < binParts.length && i < charParts.length; ++i) {
      out.push(this._capEncodeBin(charParts[i], binParts[i], 8))
    }

    // put it all together
    return out.join('')
  }

  /**
   */
  _capEncodeBin (orig, bin, min) {
    bin = bin.split('')
    let out = []
    let count = 0
    for (let c of orig) {
      if (RE_IS_ALPHA.test(c)) {
        ++count
        out.push(bin.shift() === '1' ? c.toUpperCase() : c.toLowerCase())
      } else {
        out.push(c)
      }
    }
    out = out.join('')
    return count >= min ? out : out.toLowerCase()
  }

  /**
   */
  _b32Correct (orig, charErasures) {
    const out = []
    for (let i = 0; i < orig.length; ++i) {
      const c = orig[i]
      if (RE_IS_B32_CANNON.test(c)) {
        out.push(c)
        continue
      }
      switch (c) {
        case '0': out.push('O'); break
        case '1': case 'L': out.push('I'); break
        case 'l': out.push('i'); break
        case '2': out.push('Z'); break
        case '_': default:
          charErasures.push(i)
          out.push('A')
          break
      }
    }
    return out.join('')
  }

  /**
   */
  _capDecode (str, charErasures, trueErasures) {
    const charParts = str.slice(this._prefixCap.length).match(
      new RegExp('.{' + this._segmentLen + '}', 'g'))
    const parity = []
    for (let i = 0; i < charParts.length; ++i) {
      const part = charParts[i]

      const trueEIdx = this._keyByteCount + this._keyParityByteCount + i

      let bin = []
      for (let j = 0; j < part.length; ++j) {
        const c = part[j]

        const charEIdx = this._prefixCap.length +
          (this._segmentLen * i) + j

        if (charErasures.indexOf(charEIdx) > -1) {
          // this parity byte will be marked as a true erasure
          bin = []
          break
        }

        if (RE_IS_ALPHA_UP.test(c)) {
          bin.push(1)
        } else if (RE_IS_ALPHA_LO.test(c)) {
          bin.push(0)
        }
        if (bin.length >= 8) {
          break
        }
      }

      if (bin.length < 8) {
        trueErasures.push(trueEIdx)
        parity.push(null)
        continue
      }

      bin = bin.join('')

      if (bin === '11111111' || bin === '00000000') {
        trueErasures.push(trueEIdx)
        parity.push(null)
      } else {
        parity.push(parseInt(bin, 2))
      }
    }
    return parity
  }
}

// export version 0 of 'HcK...' encoding
exports.hck0 = new HoloBase32({
  keyByteCount: 32,
  keyParityByteCount: 4,
  capParityByteCount: 4,
  prefix: Buffer.from('389424', 'hex'),
  prefixCap: '101',
  segmentLen: 15
})
