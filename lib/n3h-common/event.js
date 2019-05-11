const { AsyncClass } = require('./async-class')

/**
 */
function makeImmutable (o) {
  if (Array.isArray(o)) {
    for (let i of o) {
      makeImmutable(i)
    }
    Object.freeze(o)
    Object.seal(o)
  } else if (!o) {
    /* pass */
  } else if (typeof o === 'object') {
    for (let k in o) {
      makeImmutable(o[k])
    }
    Object.freeze(o)
    Object.seal(o)
  }
}

/**
 */
function createEvent (magic, type, params) {
  const out = Object.create(null)
  Object.defineProperty(out, magic, {
    value: true
  })
  out.type = type
  for (let k in params) {
    if (k === 'type' || k === magic) {
      throw new Error('bad event parameter name')
    }
    out[k] = params[k]
  }
  makeImmutable(out)
  return out
}

/**
 */
exports.createEventSpec = (events) => {
  const evtMagic = AsyncClass.createUid()

  const types = Object.create(null)
  const out = Object.create(null)

  Object.defineProperties(out, {
    isEvent: {
      value: evt => {
        return evt &&
          typeof evt === 'object' &&
          evt[evtMagic] &&
          Object.isFrozen(evt) &&
          Object.isSealed(evt) &&
          evt.type in types
      }
    },
    types: {
      value: types
    }
  })

  for (let evtName in events) {
    types[evtName] = evtName
    const fn = events[evtName]
    if (typeof fn !== 'function') {
      throw new Error('fn must be a function')
    }
    out[evtName] = (...args) => {
      return createEvent(evtMagic, evtName, fn(...args))
    }
  }

  makeImmutable(types)
  makeImmutable(out)
  return out
}
