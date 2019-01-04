const { expect } = require('chai')

const range = require('./range')
const aa = range.rAsciiArt
const mks = range.rFromStart
const mkr = range.rFromRadius

describe('Range Suite', () => {
  describe('fromRadius', () => {
    ;[
      [mkr('00000000', '000000c8'), '32rffffff38:00000190'],
      [mkr('00000000', '7fffffff'), '32r80000001:fffffffe']
    ].forEach(vals => {
      it(range.rAsciiArt(vals[0]), () => {
        expect(vals[0]).equals(vals[1])
      })
    })
  })

  describe('fromStart', () => {
    ;[
      [mks('00000000', '00000000'), '32r00000000:00000000'],
      [mks('00000000', range.LMAX), '32r00000000:100000000'],
      [mks('ffffff00', '00000f00'), '32rffffff00:00000f00'],
      [mks('ffffff38', '00000190'), '32rffffff38:00000190'],
      [mks(range.MIN, '3fffffff'), '32r00000000:3fffffff'],
      [mks(range.MAX, '3fffffff'), '32rffffffff:3fffffff']
    ].forEach(vals => {
      it(aa(vals[0]), () => {
        expect(vals[0]).equals(vals[1])
      })
    })
  })

  describe('rForwardDist', () => {
    ;[
      ['00000000', '00000000', '00000000'],
      ['ffffffff', 'ffffffff', '00000000'],
      ['00000000', '00000001', '00000001'],
      ['00000000', 'ffffffff', 'ffffffff'],
      ['ffffffff', '00000000', '00000001'],
      ['ffffffff', '00000001', '00000002'],
      ['fffffffe', '00000000', '00000002']
    ].forEach(vals => {
      it(vals[0] + ' to ' + vals[1] + ' = ' + vals[2], () => {
        expect(range.rForwardDist(vals[0], vals[1])).equals(vals[2])
      })
    })
  })

  describe('rInvert', () => {
    ;[
      [mks('00000000', '00000000'), mks('00000000', range.LMAX)],
      [mks('80000000', '80000000'), mks('00000000', '80000000')]
    ].forEach(vals => {
      it('should convert\n' + aa(vals[0]) + ' into\n' + aa(vals[1]), () => {
        expect(range.rInvert(vals[0])).equals(vals[1])
      })
    })
  })

  describe('rCoversPoint', () => {
    ;[
      [mks('00000032', '00000001'), '00000032', true],
      [mks('00000032', '00000000'), '00000032', false],
      [mks('00000032', '00000001'), '00000033', false],
      [mks('00000032', '00000001'), '00000031', false],
      [mks('00000000', range.LMAX), 'ffffffff', true],
      [mks('00000000', 'ffffffff'), 'ffffffff', false],
      [mks('ffffffff', '00000001'), 'ffffffff', true],
      [mks('ffffffff', '00000001'), '00000000', false],
      [mks('ffffffff', '00000002'), '00000000', true]
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
      [mks('00000000', '00000000'), mks('00000000', '00000001'), false],
      [mks('00000000', '00000001'), mks('00000000', '00000001'), true],
      [mks('00000000', '00000001'), mks('00000000', '00000002'), false],
      [mks('00000001', '00000001'), mks('00000000', '00000002'), false],
      [mks('00000000', range.LMAX), mks('00000000', '00000001'), true],
      [mks('00000000', 'ffffffff'), mks('ffffffff', '00000001'), false],
      [mks('00000000', 'ffffffff'), mks('fffffffe', '00000001'), true],
      [mks('ffffffff', '00000001'), mks('ffffffff', '00000001'), true],
      [mks('ffffffff', '00000001'), mks('00000000', '00000001'), false],
      [mks('ffffffff', '00000002'), mks('00000000', '00000001'), true],
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
      [1, mks('00000000', '00000002'), mks('00000000', '00000001'), mks('00000001', '00000001')],
      [2, mks('00000000', '00000002'), mks('00000001', '00000001'), mks('00000000', '00000001')],
      [3, mks('00000000', '00000002'), mks('ffffffff', '00000004'), mks('00000000', '00000000')],
      [4, mks('00000000', '00000002'), mks('00000000', '00000000'), mks('00000000', '00000002')],
      [5, mks('00000000', '00000004'), mks('00000002', '00000000'), mks('00000000', '00000004')],
      [6, mks('ffffffff', '00000002'), mks('ffffffff', '00000001'), mks('00000000', '00000001')],
      [7, mks('ffffffff', '00000002'), mks('00000000', '00000001'), mks('ffffffff', '00000001')],
      [8, mks('00000000', '00000001'), mks(range.MIN, range.LMAX), mks('00000000', '00000000')],
      [9, mks('ffffffff', '00000001'), mks(range.MIN, range.LMAX), mks('ffffffff', '00000000')],
      [10, mks('80000000', '00000003'), mks('80000002', 'ffffffff'), mks('80000001', '00000001')],
      [11, mks('80000000', 'ffffffff'), mks('7ffffffe', '00000003'), mks('80000001', 'fffffffd')]
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

  describe('rUnion', () => {
    ;[
      [1, mks('00000000', '00000002'), mks('00000000', '00000001'), mks('00000000', '00000001')],
      [2, mks('00000000', '00000001'), mks('00000000', '00000000'), mks('00000000', '00000000')],
      [3, mks('00000000', '00000002'), mks('00000001', '00000001'), mks('00000001', '00000001')],
      [4, mks('00000001', '00000001'), mks('00000000', '00000002'), mks('00000001', '00000001')],
      [5, mks('00000000', '00000000'), mks('00000000', '00000001'), mks('00000000', '00000000')],
      [6, mks('00000000', '00000001'), mks('00000000', '00000000'), mks('00000000', '00000000')],
      [7, mks('00000000', '00000001'), mks('0000000a', '00000001'), mks('00000000', '00000000')],
      [8, mks('00000000', '00000004'), mks('00000001', '00000001'), mks('00000001', '00000001')],
      [9, mks('00000001', '00000001'), mks('00000000', '00000004'), mks('00000001', '00000001')],
      [10, mks('ffffffff', '00000002'), mks('ffffffff', '00000001'), mks('ffffffff', '00000001')],
      [11, mks('ffffffff', '00000002'), mks('00000000', '00000001'), mks('00000000', '00000001')],
      [12, mks('ffffffff', '00000001'), mks('ffffffff', '00000002'), mks('ffffffff', '00000001')],
      [13, mks('00000000', '00000001'), mks('ffffffff', '00000002'), mks('00000000', '00000001')],
      [14, mks('ffffffff', '00000001'), mks('fffffffe', '00000002'), mks('ffffffff', '00000001')],
      [15, mks('80000000', range.LMAX), mks('7fffffff', '00000001'), mks('7fffffff', '00000001')],
      [16, mks('80000000', 'ffffffff'), mks('7fffffff', '00000001'), mks('80000000', '00000000')],
      [17, mks('80000000', 'ffffffff'), mks('7ffffffe', '00000001'), mks('7ffffffe', '00000001')]
    ].forEach(vals => {
      const rA = vals[1]
      const rB = vals[2]
      const rExpect = vals[3]
      it(
        vals[0] + ': union A with B should give C' +
        '\n(A): ' + aa(rA) +
        '\n(B): ' + aa(rB) +
        '\n(C): ' + aa(rExpect), () => {
          expect(range.rUnion(rA, rB)).equals(rExpect)
        }
      )
    })
  })

  describe('rCoverage', () => {
    ;[
      [
        1,
        mks('00000002', '00000002'),
        [
          mks('00000005', '00000001'),
          mks('00000004', '00000001'),
          mks('00000003', '00000001'),
          mks('00000002', '00000001'),
          mks('00000001', '00000001')
        ],
        {
          within: [
            mks('00000002', '00000001'),
            mks('00000003', '00000001'),
          ],
          coverageCount: 1,
          nextHole: 2
        }
      ],
      [
        2,
        mks('00000002', '00000002'),
        [
          mks('00000000', '00000005'),
          mks('00000000', '0000000a')
        ],
        {
          within: [
            mks('00000000', '0000000a'),
            mks('00000000', '00000005')
          ],
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
