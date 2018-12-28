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
 */

const MIN = exports.MIN = 0x80000000 | 0
const MAX = exports.MAX = 0x7fffffff | 0
const LMAX = exports.LMAX = 0xffffffff

const AAFACT = 10 / LMAX

const xReParse = /^32r([0-9a-f]{8}):([0-9a-f]{8})$/

// parse a string range into a normalized object
function _parse (r) {
  const m = r.match(xReParse)
  if (!m || m.length !== 3) {
    console.log('##', m)
    throw new Error('could not parse range: "' + r + '"')
  }
  return _norm({
    beg: parseInt(m[1], 16) | 0,
    len: parseInt(m[2], 16)
  })
}

// render a normalized object into a string range
function _repr (r) {
  const beg = (r.beg < 0 ? 0x100000000 + r.beg : r.beg)
    .toString(16)
    .padStart(8, '0')
  const len = (r.len)
    .toString(16)
    .padStart(8, '0')
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
  const end = _point(beg + r.len)
  return { beg, end, len: r.len }
}

// fix a point provided as input
function _fixPoint (p) {
  if (typeof p === 'string') {
    p = parseInt(p, 16)
  }
  return p | 0
}

// fix a length provided as input
function _fixLen (l) {
  if (typeof l === 'string') {
    l = parseInt(l, 16)
  }
  return l
}

/**
 */
exports.rValidate = function rValidate (r) {
  return _repr(_parse(r))
}

// create a range string from a center and radius
function _fromRadius (center, radius) {
  center = _fixPoint(center)
  radius = _fixLen(radius)
  return _repr(_norm({
    beg: center - radius,
    len: radius * 2
  }))
}

// export
exports.rFromRadius = _fromRadius

// crate a range string from a start point and length
function _fromStart (start, length) {
  start = _fixPoint(start)
  length = _fixLen(length)
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
  return _parse(r).beg
}

// render ascii art showing where this range falls in int32 space
function _asciiArt (r) {
  const isOutside = r.beg === r.end
    ? r.len > 0
    : r.beg > r.end
  const beg = 0 | (r.beg * AAFACT)
  const end = 0 | (r.end * AAFACT)
  let out = ['[']
  for (let a = -5; a < 5; ++a) {
    if (beg === a && end === a) {
      out.push('|')
    } else if (beg === a) {
      out.push('<')
    } else if (end === a) {
      out.push('>')
    } else if (isOutside && (a < end || a > beg)) {
      out.push('-')
    } else if (!isOutside && a > beg && a < end) {
      out.push('-')
    } else {
      out.push(' ')
    }
  }
  out.push(']')
  return out.join('')
}

/**
 * return a range string with additional ascii art visualization
 */
exports.rAsciiArt = function rAsciiArt (r) {
  return _asciiArt(_parse(r)) + '=' + r
}

// clone a normalized object, potentially altering characteristics
function _alter (r, opt) {
  opt || (opt = {})
  return _norm({
    beg: typeof opt.beg === 'number' ? opt.beg : r.beg,
    len: typeof opt.len === 'number' ? opt.len : r.len
  })
}

// invert a range (wrap around the other way)
function _invert (r) {
  return _alter(r, {
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
  if (r.len < 1) {
    return false
  } else if (r.len >= LMAX) {
    return true
  } else if (point === r.beg || point === r.end) {
    return true
  } else if (
    r.beg > r.end && (
      point > r.beg || point < r.end
    )
  ) {
    return true
  } else if (
    r.end > r.beg && point > r.beg && point < r.end
  ) {
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
  return _coversPoint(_parse(r), _fixPoint(point))
}

// does `rCheck` fully cover `rTarget`?
// (might catch ends, but wrap the other way)
function _fullyCovers (rCheck, rTarget) {
  if (rCheck.len >= LMAX) {
    return true
  }

  if (
    !_coversPoint(rCheck, rTarget.beg) ||
    !_coversPoint(rCheck, rTarget.end)
  ) {
    return false
  }

  // offset all numbers by other beg and normalize
  const targetStart = _point(rTarget, rTarget.beg - rCheck.beg)
  const targetEnd = _point(rTarget, rTarget.end - rCheck.beg)

  if (targetEnd >= targetStart) {
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
  if (rSource.len === 0 || rCutBy.len === 0) {
    return rSource
  }
  if (_fullyCovers(rCutBy, rSource)) {
    return _alter(rSource, {
      len: 0
    })
  }

  const srcBeg = 0
  const srcEnd = _point(rSource.end - rSource.beg)
  const cutBeg = _point(rCutBy.beg - rSource.beg)
  const cutEnd = _point(rCutBy.end - rSource.beg)

  let newBeg = srcBeg
  let newEnd = srcEnd

  if (cutEnd < srcEnd) {
    newBeg = cutEnd
  } else if (cutBeg < srcEnd) {
    newEnd = cutBeg
  }

  const newRange = _alter(rSource, {
    beg: _point(newBeg + rSource.beg),
    len: newEnd - newBeg
  })

  return newRange
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
