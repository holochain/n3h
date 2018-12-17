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

// parse our range representation
const reParseRange = /^r\[(-?\d+)\+(\d+):(-?\d+)\+(\d+)\]$/

// parse repr string into a normalized object
function _parse (r) {
  const m = r.match(reParseRange)
  if (!m || m.length !== 5) {
    throw new Error('invalid range')
  }
  return _norm({
    beg: parseInt(m[1], 10),
    len: parseInt(m[2], 10),
    fBeg: parseInt(m[3], 10),
    fLen: parseInt(m[4], 10)
  })
}

// convert a normalized object back into a repr string
function _repr (r) {
  return `r[${r.beg}+${r.len}:${r.fBeg}+${r.fLen}]`
}

// normalize a point given range boundaries
function _normPoint (r, point) {
  const fEnd = r.fBeg + r.fLen - 1
  for (;;) {
    if (point < r.fBeg) {
      point = fEnd - (r.fBeg - point) + 1
    } else if (point > fEnd) {
      point = r.fBeg + (point - fEnd) - 1
    } else {
      return point
    }
  }
}

// clean up and add a couple additional fields to a normalize object
function _norm (r) {
  if (r.fLen === 0 || (0 | r.fLen) !== r.fLen) {
    console.error('@@', r.fLen)
    throw new Error('invalid range')
  }
  if (r.len > r.fLen || (0 | r.len) !== r.len) {
    throw new Error('invalid range')
  }
  const beg = _normPoint(r, r.beg)
  return {
    beg,
    len: r.len,
    end: _normPoint(r, beg + r.len),
    fBeg: r.fBeg,
    fLen: r.fLen,
    fEnd: r.fBeg + r.fLen - 1
  }
}

// clone a normalized object, potentially altering characteristics
function _alter (r, opt) {
  opt || (opt = {})
  return _norm({
    beg: typeof opt.beg === 'number' ? opt.beg : r.beg,
    len: typeof opt.len === 'number' ? opt.len : r.len,
    fBeg: typeof opt.fBeg === 'number' ? opt.fBeg : r.fBeg,
    fLen: typeof opt.fLen === 'number' ? opt.fLen : r.fLen
  })
}

// convert a normalized object into ascii art for debugging
function _asciiArt (r) {
  const isOutside = r.beg === r.end
    ? r.len > 0
    : r.beg > r.end
  const factor = 10 / r.fLen
  const start = 0 | (r.beg * factor)
  const end = 0 | (r.end * factor)
  let out = '['
  for (let i = 0; i < 10; ++i) {
    if (start === i && end === i) {
      out += '|'
    } else if (start === i) {
      out += '<'
    } else if (end === i) {
      out += '>'
    } else if (isOutside && (i < end || i > start)) {
      out += '-'
    } else if (!isOutside && i > start && i < end) {
      out += '-'
    } else {
      out += ' '
    }
  }
  out += ']'
  return out
}

// invert a range (wrap around the other way)
function _invert (r) {
  return _alter(r, {
    beg: r.beg + r.len,
    len: r.fLen - r.len
  })
}

// does `point` fall within range `r`?
function _coversPoint (r, point) {
  point = _normPoint(r, point)
  if (point === r.beg || point === r.end) {
    return true
  } else if (r.len === 0) {
    return false
  } else if (r.len === r.fLen) {
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

// does `rCheck` fully cover `rTarget`?
// (might catch ends, but wrap the other way)
function _fullyCovers (rCheck, rTarget) {
  if (rCheck.len === rCheck.fLen) {
    return true
  }

  if (
    !_coversPoint(rCheck, rTarget.beg) ||
    !_coversPoint(rCheck, rTarget.end)
  ) {
    return false
  }

  // offset all numbers by other beg and normalize
  const targetStart = _normPoint(rTarget, rTarget.beg - rCheck.beg)
  const targetEnd = _normPoint(rTarget, rTarget.end - rCheck.beg)

  if (targetEnd >= targetStart) {
    return true
  }
  return false
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
  const srcEnd = _normPoint(rSource, rSource.end - rSource.beg)
  const cutBeg = _normPoint(rSource, rCutBy.beg - rSource.beg)
  const cutEnd = _normPoint(rSource, rCutBy.end - rSource.beg)

  let newBeg = srcBeg
  let newEnd = srcEnd

  if (cutEnd < srcEnd) {
    newBeg = cutEnd
  } else if (cutBeg < srcEnd) {
    newEnd = cutBeg
  }

  const newRange = _alter(rSource, {
    beg: _normPoint(rSource, newBeg + rSource.beg),
    len: newEnd - newBeg
  })

  return newRange
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
 * return the range but wrapped around the other direction
 */
exports.rInvert = function rInvert (r) {
  return _repr(_invert(_parse(r)))
}

/**
 * @param {range} r - does this range cover the point?
 * @param {number} point - the point to check (will be normalized)
 * @return {boolean} - true if point is within our range
 */
exports.rCoversPoint = function rCoversPoint (r, point) {
  return _coversPoint(_parse(r), point)
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

/**
 * Draw this range as one-line ascii art
 * @return {string} - the ascii art
 */
exports.rAsciiArt = function rAsciiArt (r) {
  return _asciiArt(_parse(r)) + '=' + r
}

/**
 * Helper for building ranges with specified boundaries
 */
exports.rFactory = function rFactory (boundStart, boundLength) {
  return {
    fromRadius: function fromRadius (center, radius) {
      return _repr(_norm({
        beg: center - radius,
        len: radius * 2,
        fBeg: boundStart,
        fLen: boundLength
      }))
    },
    fromStart: function fromStart (start, length) {
      return _repr(_norm({
        beg: start,
        len: length,
        fBeg: boundStart,
        fLen: boundLength
      }))
    }
  }
}
