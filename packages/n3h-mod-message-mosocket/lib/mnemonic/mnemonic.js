const mosodium = require('@holochain/mosodium')

const words = require('./words')

/**
 */
exports.toMnemonic = function toMnemonic (input) {
  if (
    !(input instanceof Buffer) ||
    (input.byteLength) < 4 ||
    (parseInt(input.byteLength / 4) * 4 !== input.byteLength)
  ) {
    throw new Error('required buffer of length divisible by 4')
  }

  const csLen = input.byteLength * 8 / 32
  const cs = mosodium.hash.sha256(input).slice(0, Math.ceil(csLen / 8))
  const bin = _bufToBin(input) + _bufToBin(cs).slice(0, csLen)
  return bin
    .match(/(.{1,11})/g)
    .map(b => {
      return words[parseInt(b, 2)]
    })
}

/**
 */
exports.fromMnemonic = function fromMnemonic (wordList) {
  let bin = []
  wordList.map(w => {
    _bin(bin, words.indexOf(w), 11)
  })
  bin = bin.join('')
  const idx = Math.floor(bin.length / 33) * 32
  const cs = bin.slice(idx)
  bin = bin.slice(0, idx)
  const out = Buffer.alloc(bin.length / 8)
  for (let i = 0; i < out.byteLength; ++i) {
    const s = bin.slice(i * 8, i * 8 + 8)
    out.writeUInt8(parseInt(s, 2), i)
  }

  const csLen = out.byteLength * 8 / 32
  const csNew = mosodium.hash.sha256(out).slice(0, Math.ceil(csLen / 8))
  if (cs !== _bufToBin(csNew).slice(0, csLen)) {
    throw new Error('checksum mismatch')
  }

  return out
}

/**
 */
function _bin (a, n, c) {
  n = n.toString(2).split('')
  if (n.length < c) {
    const f = (new Array(c - n.length)).fill('0')
    a.splice(a.length, 0, ...f)
  }
  a.splice(a.length, 0, ...n)
}

/**
 */
function _bufToBin (b, c) {
  const out = []
  for (let i = 0; i < b.byteLength; ++i) {
    _bin(out, b.readUInt8(i), 8)
  }
  return out.join('')
}
