const type = require('./type')

/**
 */
function _immut (i, extendFn) {
  if (Array.isArray(i)) {
    const out = []
    for (let v of i) {
      out.push(_immut(v))
    }
    Object.freeze(out)
    return out
  } else if (i === null) {
    return null
  } else if (i && typeof i === 'object') {
    const out = Object.create(null)
    for (let k in i) {
      out[k] = _immut(i[k])
    }
    if (extendFn) {
      Object.defineProperty(out, 'extend', {
        value: extendFn
      })
    }
    Object.freeze(out)
    return out
  } else {
    switch (typeof i) {
      case 'string':
      case 'number':
      case 'undefined':
      case 'boolean':
        return i
      default:
        throw new Error('unhandled immutable type ' + typeof i + ' : ' + i.toString())
    }
  }
}

/**
 */
class Entry {
  constructor (_) {
    this._ = _
  }
}

/**
 */
exports.entry = _ => new Entry(_)

/**
 */
function _checkType (handle, value) {
  handle = handle.split('.')
  let res = type.assert
  for (let part of handle) {
    res = res[part]
  }
  res(value)
}

/**
 */
function _expandDefault (def) {
  if (def instanceof Entry) {
    if ('default' in def._) {
      _checkType(def._.type, def._.default)
      return def._.default
    } else {
      return null
    }
  } else if (Array.isArray(def)) {
    // i don't even know how this would work
    throw new Error('unimplemented')
  } else if (def && typeof def === 'object') {
    const obj = Object.create(null)
    for (let k in def) {
      obj[k] = _expandDefault(def[k])
    }
    return obj
  } else {
    throw new Error('unhandled definition expansion type ' + typeof def + ' : ' + def.toString())
  }
}

/**
 */
function _extendOneProp (def, base, name, ext) {
  if (def instanceof Entry) {
    if (ext === null) {
      return null
    } else {
      _checkType(def._.type, ext)
      base[name] = ext
    }
  } else if (Array.isArray(def)) {
    // i don't even know how this would work
    throw new Error('unimplemented')
  } else if (def && typeof def === 'object') {
    _extendOneObj(def, base[name], ext)
  } else {
    throw new Error('unhandled definition expansion type ' + typeof def + ' : ' + def.toString())
  }
}

/**
 */
function _extendOneObj (def, base, ext) {
  if (def instanceof Entry) {
    throw new Error('base must be object')
  } else if (Array.isArray(def)) {
    // i don't even know how this would work
    throw new Error('unimplemented')
  } else if (def && typeof def === 'object') {
    if (!base || typeof base !== 'object') {
      throw new Error('cannot extend, base was not an object')
    }
    for (let k in ext) {
      if (!(k in def)) {
        throw new Error('invalid key: ' + k)
      }
      _extendOneProp(def[k], base, k, ext[k])
    }
  } else {
    throw new Error('unhandled definition expansion type ' + typeof def + ' : ' + def.toString())
  }
}

/**
 */
exports.createDefinition = def => {
  const extendFn = (...list) => {
    const obj = _expandDefault(def)
    for (let i of list) {
      _extendOneObj(def, obj, i)
    }
    return _immut(obj, extendFn)
  }

  return extendFn
}
