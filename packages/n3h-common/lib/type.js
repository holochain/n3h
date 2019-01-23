/**
 * Library for runtime type checking
 * @module type
 */

/**
 * @private
 * instances of this class are created to store a fluent chain of commands
 */
class K {
  constructor () {
    this.s = []
    this.p = []
  }
}

/**
 * @private
 * helper for processing the next step in a sprue chain
 */
function execNext (v, s) {
  const e = s.shift()
  return e(v, s, execNext)
}

/**
 * A modifier is either a no-op word, or a get-handler function
 * if it is a function, the signature is:
 *    (value, sprue, executor) => { ... }
 * where:
 *  - `value` is the current value in the fluent chain
 *  - `sprue` is an array of handler functions yet to be processed
 *  - `executor` should be called to process the next action
 *               executor signature (value, sprue) => { ... }
 *
 * `sprue` will be emptied for each invocation of executor,
 * if you need to execute multiple times, you should clone with `sprue.slice(0)`
 * see the `arrayOf` builtin modifier for an example.
 *
 * @function addModifier
 * @param {string} n - name of the modifier
 * @param {function} f - the modifier handler function
 */
const addModifier = exports.addModifier = (n, f) => {
  if (n in K.prototype) {
    throw new Error('cannot assign existing symbol "' + n + '" as modifier')
  }
  Object.defineProperty(K.prototype, n, {
    get: function () {
      if (f) {
        this.s.push(f)
        this.p.push(n)
      }
      return this
    }
  })
  Object.defineProperty(exports, n, {
    get: () => {
      const out = new K()
      if (f) {
        // we still need to trigger the modifier
        out[n] // eslint-disable-line no-unused-expressions
      }
      return out
    }
  })
}

/**
 * fluent no-op
 *
 * @namespace is
 */
addModifier('is')

/**
 * fluent no-op
 *
 * @namespace a
 */
addModifier('a')

/**
 * fluent no-op
 *
 * @namespace an
 */
addModifier('an')

/**
 * Throw an error if the following chain results evaluate to false
 *
 * @namespace assert
 */
addModifier('assert', (v, s, e) => {
  if (!e(v, s)) {
    throw new Error()
  }
})

/**
 * Negate the following chain results
 *
 * @namespace not
 */
addModifier('not', (v, s, e) => !e(v, s))

/**
 * 1 - ensure the current value is an array
 * 2 - ensure all array components pass their following chain evaluations
 *
 * Note, empty arrays will always evaluate successfully
 *
 * @namespace arrayOf
 */
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

/**
 * A "Terminal" presents itself as an actual function, taking a value,
 * that triggers the fluent chain type evaluation.
 * That is, the `string` in `type.assert.string('test')`.
 *
 * The terminal handler function should follow the signature:
 *
 *   (value) => { return bool }
 *
 * Where:
 *   - `value` is the value to type check
 *   - `bool` is a boolean return value indicating the check result
 *
 * @function addTerminal
 * @param {string} n - name of the terminal
 * @param {function} f - the terminal handler function
 */
const addTerminal = exports.addTerminal = (n, f) => {
  if (n in K.prototype) {
    throw new Error('cannot assign existing symbol "' + n + '" as terminal')
  }
  Object.defineProperty(K.prototype, n, {
    get: function () {
      this.s.push(f)
      this.p.push(n)
      return v => {
        try {
          return execNext(v, this.s.splice(0, this.s.length))
        } catch (e) {
          throw new Error('type check fail (' + this.p.join('.') + ')')
        }
      }
    }
  })
  Object.defineProperty(exports, n, {
    get: () => f
  })
}

/**
 * is the value a string
 *
 * @function string
 * @param {*} v - value
 */
addTerminal('string', v => typeof v === 'string')

/**
 * is the value a number
 *
 * @function number
 * @param {*} v - value
 */
addTerminal('number', v => typeof v === 'number')

/**
 * is the value an object? (not null, not array)
 *
 * @function object
 * @param {*} v - value
 */
addTerminal('object', v => {
  return v && !Array.isArray(v) && typeof v === 'object'
})
