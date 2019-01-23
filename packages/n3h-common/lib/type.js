class K {
  constructor () {
    this.s = []
  }
}

function execNext (v, s) {
  const e = s.shift()
  return e(v, s, execNext)
}

const addModifier = exports.addModifier = (n, f) => {
  Object.defineProperty(K.prototype, n, {
    get: function () {
      if (f) {
        this.s.push(f)
      }
      return this
    }
  })
  Object.defineProperty(exports, n, {
    get: () => {
      const out = new K()
      if (f) {
        out[n]
      }
      return out
    }
  })
}

// fluent no-ops
addModifier('is')
addModifier('a')
addModifier('an')

addModifier('assert', (v, s, e) => {
  if (!e(v, s)) {
    throw new Error('type assert fail')
  }
})

addModifier('not', (v, s, e) => !e(v, s))

addModifier('arrayOf', (v, s, e) => {
  if (!Array.isArray(v)) {
    return false
  }
  for (let i of v) {
    if (!e(i, s.slice(0))) {
      return false
    }
  }
  return true
})

const addTerminal = exports.addTerminal = (n, f) => {
  Object.defineProperty(K.prototype, n, {
    get: function () {
      this.s.push(f)
      return v => execNext(v, this.s.splice(0, this.s.length))
    }
  })
  Object.defineProperty(exports, n, {
    get: () => f
  })
}

addTerminal('string', v => typeof v === 'string')
addTerminal('number', v => typeof v === 'number')
