const { expect } = require('chai')

const {
  rFactory,
  rInvert,
  rCoversPoint,
  rFullyCovers,
  rCut,
  rCoverage,
  rAsciiArt: aa
} = require('./range')

const {
  fromStart: f10,
  fromRadius: f10Radius
} = rFactory(0, 10)

const {
  // fromStart: f100,
  fromRadius: f100Radius
} = rFactory(0, 100)

const {
  fromStart: fNeg,
  fromRadius: fNegRadius
} = rFactory(-50, 100)

const {
  fromStart: fFull,
  fromRadius: fFullRadius
} = rFactory(-0x7fffffff, 0xffffffff)

describe('Range Suite', () => {
  describe('normalize', () => {
    ;[
      [f10(0, 0), 'r[0+0:0+10]'],
      [rFactory(-10, 20).fromStart(-1, 2), 'r[-1+2:-10+20]'],
      [f10(-1, 0), 'r[9+0:0+10]'],
      [f10(10, 0), 'r[0+0:0+10]'],
      //[fNeg(-3, 3), 'r[-3+3:-50+49]'],
      //[fNeg(-50, 49), 'r[-50+49:-50+49]'],
      [fNegRadius(0, 49), 'r[-49+98:-50+100]']
      [fFullRadius(-0x10000000, 0x20000000), 'r[-49+98:-50+100]']
    ].forEach(vals => {
      it(aa(vals[0]), () => {
        expect(vals[0]).equals(vals[1])
      })
    })
  })

  describe('rInvert', () => {
    ;[
      [f10(0, 0), f10(0, 10)],
      [f10(0, 1), f10(1, 9)],
      [f10Radius(0, 5), f10(5, 0)],
      [f10Radius(0, 4), f10(4, 2)]
    ].forEach(vals => {
      it('should convert\n' + aa(vals[0]) + ' into\n' + aa(vals[1]), () => {
        expect(rInvert(vals[0])).equals(vals[1])
      })
    })
  })

  describe('rCoversPoint', () => {
    ;[
      [f100Radius(50, 0), 50, true],
      [f100Radius(50, 2), 51, true],
      [f100Radius(50, 0), 51, false],
      [f100Radius(0, 50), 99, true],
      [f100Radius(0, 2), 1, true],
      [f100Radius(0, 2), 98, true],
      [f100Radius(0, 2), 97, false],
      [f100Radius(99, 2), 99, true],
      [f100Radius(99, 2), 1, true],
      [f100Radius(99, 2), 2, false]
    ].forEach(vals => {
      it(
        aa(vals[0]) +
        (vals[2] ? ' should cover ' : ' should not cover ') +
        vals[1], () => {
          expect(rCoversPoint(vals[0], vals[1])).equals(vals[2])
        }
      )
    })
  })

  describe('rFullyCovers', () => {
    ;[
      [f100Radius(50, 0), f100Radius(60, 0), false],
      [f100Radius(50, 0), f100Radius(50, 2), true],
      [f100Radius(50, 1), f100Radius(50, 2), true],
      [f100Radius(50, 2), f100Radius(50, 2), true],
      [f100Radius(50, 3), f100Radius(50, 2), false],
      [f100Radius(50, 50), f100Radius(50, 50), true],
      [f100Radius(50, 49), f100Radius(100, 2), false],
      [f100Radius(100, 20), f100Radius(100, 40), true],
      [f10(9, 2), f10(0, 10), true]
    ].forEach(vals => {
      const rA = vals[1]
      const rB = vals[0]
      it(
        'A should ' + (vals[2] ? '' : 'not ') + 'fully cover B' +
        '\n(A): ' + aa(rA) + '\n(B): ' + aa(rB), () => {
          expect(rFullyCovers(rA, rB)).equals(vals[2])
        }
      )
    })
  })

  describe('rCut', () => {
    ;[
      [1, f10(0, 2), f10(0, 1), f10(1, 1)],
      [2, f10(0, 2), f10(1, 1), f10(0, 1)],
      [3, f10(0, 2), f10(9, 4), f10(0, 0)],
      [4, f10(0, 2), f10(9, 10), f10(0, 0)],
      [5, f10(0, 2), f10(0, 0), f10(0, 2)],
      [6, f10(0, 4), f10(2, 0), f10(0, 4)],
      [7, f10(9, 2), f10(9, 1), f10(0, 1)],
      [8, f10(9, 2), f10(0, 1), f10(9, 1)],
      [9, f10(9, 2), f10(8, 4), f10(9, 0)],
      [10, f10(9, 2), f10(0, 10), f10(9, 0)],
      [11, f10(9, 2), f10(9, 0), f10(9, 2)],
      [12, f10(9, 4), f10(1, 0), f10(9, 4)]
    ].forEach(vals => {
      const rSrc = vals[1]
      const rCutBy = vals[2]
      const rExpect = vals[3]
      it(
        vals[0] + ': cut A with B should give C' +
        '\n(A): ' + aa(rSrc) +
        '\n(B): ' + aa(rCutBy) +
        '\n(C): ' + aa(rExpect), () => {
          expect(rCut(rSrc, rCutBy)).equals(rExpect)
        }
      )
    })
  })

  describe('rCoverage', () => {
    ;[
      [
        1,
        f10(2, 2),
        [f10(5, 1), f10(4, 1), f10(3, 1), f10(2, 1), f10(1, 1)],
        {
          within: [ f10(2, 1), f10(3, 1), f10(1, 1) ],
          coverageCount: 1,
          nextHole: 2
        }
      ],
      [
        2,
        f10(2, 2),
        [f10(0, 5), f10(0, 10)],
        {
          within: [ f10(0, 10), f10(0, 5) ],
          coverageCount: 2,
          nextHole: 2
        }
      ]
    ].forEach(vals => {
      const r = vals[1]
      const arr = vals[2]
      it('coverage test #' + vals[0], () => {
        expect(rCoverage(r, arr)).deep.equals(vals[3])
      })
    })
  })
})
