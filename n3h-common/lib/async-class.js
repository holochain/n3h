/**
 * Bizarre class that makes some things easier but less idiomatic
 * - eventemitter style on/emit, but async/await friendly
 * - constructor can be async / returns a promise
 * - destruction workflow
 *
 * to construct, you will need to await it, like:
 *   `const inst = await new AsyncClass()`
 *
 * to subclass you will also need to await `this` after calling super
 *   ```
 *   class Sub extends AsyncClass {
 *     constructor () {
 *       super(destroy)
 *       return new Promise(async (resolve, reject) => {
 *         const self = await this
 *         // any subclass specific setup on `self` here
 *         resolve(self)
 *       })
 *     }
 *   ```
 */
class AsyncClass {
  /**
   * pass in any additional destructors you may need called
   * @param {array|function|undefined} destroy - any destructors
   */
  constructor (destroy) {
    this._destroyed = false

    if (Array.isArray(destroy)) {
      this._destroy = destroy
    } else {
      if (typeof destroy === 'function') {
        this._destroy = [destroy]
      } else {
        this._destroy = []
      }
    }

    this._events = Object.create(null)

    this._destroy.push(() => {
      this._events = null
    })

    return new Promise((resolve, reject) => {
      resolve(this)
    })
  }

  /**
   * destroy will call all destructors + mark this instance unsafe for methods
   */
  async destroy () {
    if (this._destroyed) return
    this._destroyed = true
    for (let d of this._destroy) {
      await d()
    }
    this._destroy = null
  }

  /**
   * register an event listener
   * @param {string} type - the event name
   * @param {function} fn - the function that returns a promise to call
   */
  on (type, fn) {
    this.$checkDestroyed()
    if (!(type in this._events)) {
      this._events[type] = []
    }
    this._events[type].push(fn)
  }

  /**
   * synchronously call all event listeners, waiting on their promises,
   * and aggregate their responses
   * @param {string} type - the event name
   * @param {*} ...args - any arguments you want passed to the listeners
   */
  async emit (type, ...args) {
    this.$checkDestroyed()
    if (!(type in this._events)) {
      return []
    }
    return Promise.all(this._events[type].map(fn => {
      return fn(...args)
    }))
  }

  // -- protected -- //

  /**
   * throws an error if this instance has already been destroyed
   */
  $checkDestroyed () {
    if (this._destroyed) {
      throw new Error('instance used after destruction')
    }
  }
}

exports.AsyncClass = AsyncClass
