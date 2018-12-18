const { expect } = require('chai')

const range = require('./range')
const aa = range.rAsciiArt
const mks = range.rFromStart
const mkr = range.rFromRadius

describe('Range Suite', () => {
  describe('fromRadius', () => {
    ;[
      [mkr(0, 200), '32rffffff38:00000190'],
      [mkr('00000000', '000000c8'), '32rffffff38:00000190'],
      [mkr(range.MIN, 0 | (range.LMAX / 4)), '32r40000001:7ffffffe']
    ].forEach(vals => {
      it(range.rAsciiArt(vals[0]), () => {
        expect(vals[0]).equals(vals[1])
      })
    })
  })

  describe('fromStart', () => {
    ;[
      [mks(0, 0), '32r00000000:00000000'],
      [mks(0, range.LMAX), '32r00000000:ffffffff'],
      [mks(-200, 400), '32rffffff38:00000190'],
      [mks('ffffff38', '00000190'), '32rffffff38:00000190'],
      [mks(range.MIN, 0 | (range.LMAX / 4)), '32r80000000:3fffffff'],
      [mks(range.MAX, 0 | (range.LMAX / 4)), '32r7fffffff:3fffffff'],
      [mks(range.MAX + 1, 0 | (range.LMAX / 4)), '32r80000000:3fffffff']
    ].forEach(vals => {
      it(aa(vals[0]), () => {
        expect(vals[0]).equals(vals[1])
      })
    })
  })

  describe('rInvert', () => {
    ;[
      [mks(0, 0), mks(0, range.LMAX)]
    ].forEach(vals => {
      it('should convert\n' + aa(vals[0]) + ' into\n' + aa(vals[1]), () => {
        expect(range.rInvert(vals[0])).equals(vals[1])
      })
    })
  })

  describe('rCoversPoint', () => {
    ;[
      [mks(0x32, 1), 0x32, true],
      [mks(0x32, 0), 0x32, false],
      [mkr(0x32, 1), 0x33, true],
      [mkr(0x32, 1), 0x34, false],
      [mks(0, range.LMAX), -1, true],
      [mks(0, range.LMAX - 1), -1, false],
      [mkr(range.MIN, 1), range.MIN, true],
      [mkr(range.MIN, 1), range.MAX, true],
      [mkr(range.MIN, 1), range.MAX - 1, false],
      [mkr(range.MAX, 1), range.MAX, true],
      [mkr(range.MAX, 1), range.MIN, true],
      [mkr(range.MAX, 1), range.MIN + 1, false]
    ].forEach(vals => {
      it(
        aa(vals[0]) +
        (vals[2] ? ' should cover 0x' : ' should not cover 0x') +
        vals[1].toString(16), () => {
          expect(range.rCoversPoint(vals[0], vals[1])).equals(vals[2])
        }
      )
    })
  })

  describe('rFullyCovers', () => {
    ;[
      [mks(0, 0), mks(0, 1), false],
      [mks(0, 1), mks(0, 1), true],
      [mks(0, 1), mks(0, 2), false],
      [mks(1, 1), mks(0, 2), false],
      [mks(0, range.LMAX), mks(range.MIN, 1), true],
      [mks(range.MIN, range.LMAX - 1), mks(range.MAX, 1), false],
      [mks(range.MAX, 2), mks(range.MIN, 1), true]
    ].forEach(vals => {
      const rA = vals[0]
      const rB = vals[1]
      it(
        'A should ' + (vals[2] ? '' : 'not ') + 'fully cover B' +
        '\n(A): ' + aa(rA) + '\n(B): ' + aa(rB), () => {
          expect(range.rFullyCovers(rA, rB)).equals(vals[2])
        }
      )
    })
  })

  describe('rCut', () => {
    ;[
      [1, mks(0, 2), mks(0, 1), mks(1, 1)],
      [2, mks(0, 2), mks(1, 1), mks(0, 1)],
      [3, mks(range.MIN, 2), mks(range.MAX, 4), mks(range.MIN, 0)],
      [4, mks(0, 2), mks(0, 0), mks(0, 2)],
      [5, mks(0, 4), mks(2, 0), mks(0, 4)],
      [6, mks(range.MAX, 2), mks(range.MAX, 1), mks(range.MIN, 1)],
      [7, mks(range.MAX, 2), mks(range.MIN, 1), mks(range.MAX, 1)],
      [8, mks(0, 1), mks(range.MIN, range.LMAX), mks(0, 0)]
    ].forEach(vals => {
      const rSrc = vals[1]
      const rCutBy = vals[2]
      const rExpect = vals[3]
      it(
        vals[0] + ': cut A with B should give C' +
        '\n(A): ' + aa(rSrc) +
        '\n(B): ' + aa(rCutBy) +
        '\n(C): ' + aa(rExpect), () => {
          expect(range.rCut(rSrc, rCutBy)).equals(rExpect)
        }
      )
    })
  })

  describe('rCoverage', () => {
    ;[
      [
        1,
        mks(2, 2),
        [mks(5, 1), mks(4, 1), mks(3, 1), mks(2, 1), mks(1, 1)],
        {
          within: [ mks(2, 1), mks(3, 1), mks(1, 1) ],
          coverageCount: 1,
          nextHole: 2
        }
      ],
      [
        2,
        mks(2, 2),
        [mks(0, 5), mks(0, 10)],
        {
          within: [ mks(0, 10), mks(0, 5) ],
          coverageCount: 2,
          nextHole: 2
        }
      ]
    ].forEach(vals => {
      const r = vals[1]
      const arr = vals[2]
      it('coverage test #' + vals[0], () => {
        expect(range.rCoverage(r, arr)).deep.equals(vals[3])
      })
    })
  })
})
