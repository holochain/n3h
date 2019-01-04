'use strict'

/*
 * Javascript wrapping range library for rrdht
 * Provides functions for tracking and comparing
 * ranges defined as a center point and radius
 * on a wrapping integer loop with arbitrary
 * start / end points
 *
 * This is an accurate but naive implementation to get us going.
 * Someday need to refactor for efficiency.
 *
 * We have a tricky workaround here. We need to be able to represent
 * both zero length ranges, and full ranges. We cannot do this with 4 bytes.
 * (hence allowing 9 characters for the length repr hex digits)
 *
 * Since this is javascript, and numbers are all 64 bits anyways, we just
 * go ahead and represent the length directly (see LMAX)
 */

const MIN = 0x00000000
exports.MIN = _reprPoint(MIN)
const MAX = 0xffffffff
exports.MAX = _reprPoint(MAX)
const LMAX = 0x100000000
exports.LMAX = _reprLen(LMAX)

const AAFACT = 10 / LMAX

const xReParse = /^32r([0-9a-f]{8}):([0-9a-f]{8,9})$/

// parse a string range into a normalized object
function _parse (r) {
  const m = r.match(xReParse)
  if (!m || m.length !== 3) {
    throw new Error('could not parse range: "' + r + '" (' + m + ')')
  }
  return _norm({
    beg: _parsePoint(m[1]),
    len: _parseLen(m[2])
  })
}

// render a normalized object into a string range
function _repr (r) {
  const beg = _reprPoint(r.beg)
  const len = _reprLen(r.len)
  return `32r${beg}:${len}`
}

// normalize a single point
function _point (point) {
  for (;;) {
    if (point < MIN) {
      point = MAX - (MIN - point) + 1
    } else if (point > MAX) {
      point = MIN + (point - MAX) - 1
    } else {
      return point
    }
  }
}

// given a starting point and a length, return a normalized object
// with `beg` and `end` points and a `len`
function _norm (r) {
  if (r.len < 0 || r.len > LMAX) {
    throw new Error('invalid range length')
  }
  const beg = _point(r.beg)
  return { beg, len: r.len }
}

const RE_POINT = /^[a-f0-9]{8}$/

// fix a point provided as input
function _parsePoint (p) {
  if (typeof p !== 'string' || !RE_POINT.test(p)) {
    throw new Error('expected 8 hex characters')
  }
  return parseInt(p, 16)
}

const RE_LEN = /^[a-f0-9]{8,9}$/

// fix a length provided as input
function _parseLen (l) {
  if (typeof l !== 'string' || !RE_LEN.test(l)) {
    throw new Error('expected 8 or 9 hex characters')
  }
  const len = parseInt(l, 16)
  if (len < 0 || len > LMAX) {
    throw new Error('invalid range length')
  }
  return len
}

// render a point to a hex string
function _reprPoint (p) {
  return p
    .toString(16)
    .padStart(8, '0')
}

// render a length to a hex string
function _reprLen (l) {
  // same as reprPoint for now
  return _reprPoint(l)
}

/**
 */
exports.rValidate = function rValidate (r) {
  return _repr(_parse(r))
}

// create a range string from a center and radius
function _fromRadius (center, radius) {
  center = _parsePoint(center)
  radius = _parseLen(radius)
  return _repr(_norm({
    beg: center - radius,
    len: radius * 2
  }))
}

// export
exports.rFromRadius = _fromRadius

// crate a range string from a start point and length
function _fromStart (start, length) {
  start = _parsePoint(start)
  length = _parseLen(length)
  return _repr(_norm({
    beg: start,
    len: length
  }))
}

// export
exports.rFromStart = _fromStart

const RE_RADII = /^[a-f0-9]{24}$/
exports.rFromRadiiHold = function rFromRadiiHold (r) {
  if (!RE_RADII.test(r)) {
    throw new Error(Object.prototype.toString.call(r) + ' is not a valid radii')
  }
  return `32r${r.substr(0, 8)}:${r.substr(8, 8)}`
}

/**
 */
exports.rGetStart = function rGetStart (r) {
  return _reprPoint(_parse(r).beg)
}

// render ascii art showing where this range falls in int32 space
function _asciiArt (r) {
  const out = ['[', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ']']
  const len = Math.floor(r.len * AAFACT) + 1
  const beg = Math.floor(r.beg * AAFACT)
  for (let i = 0, cur = beg; i < len; ++i, ++cur) {
    if (cur + 1 > 10) {
      cur = 0
    }
    if (cur === beg) {
      out[cur + 1] = '|'
    } else {
      out[cur + 1] = '-'
    }
  }
  return out.join('')
}

/**
 * return a range string with additional ascii art visualization
 */
exports.rAsciiArt = function rAsciiArt (r) {
  return _asciiArt(_parse(r)) + '=' + r
}

// get the distance from pointA to pointB counting forward only
function _forwardDist (pointA, pointB) {
  pointA = _point(pointA)
  pointB = _point(pointB)
  if (pointB >= pointA) {
    return pointB - pointA
  }
  return (MAX - pointA) + (pointB - MIN) + 1
}

/**
 */
exports.rForwardDist = function rForwardDist (pointA, pointB) {
  return _reprLen(_forwardDist(_parsePoint(pointA), _parsePoint(pointB)))
}

// invert a range (wrap around the other way)
function _invert (r) {
  return _norm({
    beg: r.beg + r.len,
    len: LMAX - r.len
  })
}

/**
 * return the range but wrapped around the other direction
 */
exports.rInvert = function rInvert (r) {
  return _repr(_invert(_parse(r)))
}

// does `point` fall within range `r`?
function _coversPoint (r, point) {
  point = _point(point)

  const dist = _forwardDist(r.beg, point)
  if (dist < r.len) {
    return true
  }
  return false
}

/**
 * @param {range} r - does this range cover the point?
 * @param {number} point - the point to check (will be normalized)
 * @return {boolean} - true if point is within our range
 */
exports.rCoversPoint = function rCoversPoint (r, point) {
  return _coversPoint(_parse(r), _parsePoint(point))
}

// does `rCheck` fully cover `rTarget`?
// (might catch ends, but wrap the other way)
function _fullyCovers (rCheck, rTarget) {
  const dist = _forwardDist(rCheck.beg, rTarget.beg)
  if (rTarget.len + dist <= rCheck.len) {
    return true
  }
  return false
}

/**
 * It's hard to tell if a range covers us or instead wraps around
 * and touches us on both sides the other direction
 * @param {range} rCheck - does this range fully cover the target?
 * @param {range} rTarget - is this target range fully coverd by the check?
 * @return {boolean} - true if check fully covers the target range
 */
exports.rFullyCovers = function rFullyCovers (rCheck, rTarget) {
  return _fullyCovers(_parse(rCheck), _parse(rTarget))
}

// cut rSource with rCutBy
function _cut (rSource, rCutBy) {
  // special exception, early return if rCutBy len is zero
  if (rCutBy.len < 1) {
    return rSource
  }

  let len = rSource.len
  let beg = rSource.beg

  // -- first, cut the front -- //

  let dist = _forwardDist(rCutBy.beg, rSource.beg)
  let cutBy = rCutBy.len - dist
  if (cutBy > 0) {
    len -= cutBy
    beg += cutBy
  }

  if (len < 1) {
    return _norm({
      beg: rSource.beg,
      len: 0
    })
  }

  // -- second, cut the back -- //

  // we don't allow cutting a range into multiple segments
  // so, if the beginning of rCutBy is within us, trim everything following

  const rN = _norm({
    beg,
    len
  })

  dist = _forwardDist(beg, rCutBy.beg)
  if (dist > 0 && dist <= len) {
    len = dist
  }

  if (len < 1) {
    return _norm({
      beg: rSource.beg,
      len: 0
    })
  }

  return _norm({
    beg,
    len
  })
}

/**
 * return a new range that is the source range
 * except with any overlap of `rCutBy` removed
 * @param {range} rSource - the initial range
 * @param {range} rCutBy - the range to cut from rSource
 * @return {range}
 */
exports.rCut = function rCut (rSource, rCutBy) {
  return _repr(_cut(_parse(rSource), _parse(rCutBy)))
}

// help fn for _union below
function _fixUnion (beg, minA, minB) {
  let len = Math.min(minA, minB)
  if (len < 0) {
    len = 0
  }
  return _norm({
    beg,
    len
  })
}

// return overlap of rA and rB
function _union (rA, rB) {
  const distA = _forwardDist(rA.beg, rB.beg)
  const distB = _forwardDist(rB.beg, rA.beg)

  if (distA < rA.len) {
    return _fixUnion(rA.beg + distA, rB.len, rA.len - distA)
  } else {
    return _fixUnion(rB.beg + distB, rA.len, rB.len - distB)
  }
}

/**
 * return a new range that is overlap of rA and rB, or len 0 if no overlap
 * @param {range} rA - first range
 * @param {range} rB - second range
 * @return {range}
 */
exports.rUnion = function rUnion (rA, rB) {
  return _repr(_union(_parse(rA), _parse(rB)))
}

// calculate coverage
function _coverage (r, arr) {
  const farr = []
  arr.forEach(item => {
    if (item.len > 0) {
      farr.push(item)
    }
  })
  farr.sort((a, b) => {
    if (a.len > b.len) {
      return -1
    } else if (a.len < b.len) {
      return 1
    }
    return 0
  })

  const within = []
  let coverageCount = 0
  let remainingToCover = r

  const findNext = () => {
    for (let i = 0; i < farr.length; ++i) {
      const item = farr[i]
      if (_coversPoint(item, remainingToCover.beg)) {
        farr.splice(i, 1)
        within.push(item)
        remainingToCover = _cut(remainingToCover, item)
        if (remainingToCover.len < 1) {
          coverageCount += 1
          remainingToCover = r
        }
        return true
      }
    }
    return false
  }

  for (;;) {
    if (!farr.length) {
      break
    }
    if (!findNext()) {
      break
    }
  }

  return {
    within,
    coverageCount,
    nextHole: remainingToCover.beg
  }
}

/**
 * Given an array of ranges, calculate the coverage
 * This is a bit naive:
 *  - sort the array large to small
 *  - iterate over elements looking for any overlap at all
 * @param {array<Range>} arr - the array of range instances
 */
exports.rCoverage = function rCoverage (r, arr) {
  r = _parse(r)
  arr = arr.map(r => _parse(r))

  const result = _coverage(r, arr)

  return {
    within: result.within.map(i => _repr(i)),
    coverageCount: result.coverageCount,
    nextHole: result.nextHole
  }
}
