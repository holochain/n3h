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
   */
  constructor (...params) {
    return AsyncClass.$construct(this, async (self) => {
      self._calledSuperInit = false

      await self.init(...params)

      if (!self._calledSuperInit) {
        throw new Error('super.init() not called')
      }

      return self
    })
  }

  /**
   */
  async init () {
    this._destroyed = false
    this._destroy = []

    this._events = Object.create(null)

    this._calledSuperInit = true

    this.$pushDestructor(() => {
      this._events = null
    })
  }

  /**
   * destroy will call all destructors + mark this instance unsafe for methods
   */
  async destroy () {
    if (this._destroyed) return
    for (let d of this._destroy) {
      try {
        await d()
      } catch (e) {
        console.error(e)
        throw e
      }
    }
    this._destroyed = true
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
   */
  static $construct (inst, fn) {
    return new Promise(async (resolve, reject) => {
      try {
        inst = await inst
        if (!(inst instanceof AsyncClass)) {
          throw new Error('bad $construct call, inst not AsyncClass')
        }
        const res = await fn.call(inst, inst)
        if (!(res instanceof AsyncClass)) {
          throw new Error('bad $construct call, return value not AsyncClass')
        }
        resolve(res)
      } catch (e) {
        reject(e)
      }
    })
  }

  /**
   */
  $isDestroyed () {
    return this._destroyed
  }

  /**
   * throws an error if this instance has already been destroyed
   */
  $checkDestroyed () {
    if (this._destroyed) {
      throw new Error('instance used after destruction')
    }
  }

  /**
   */
  $pushDestructor (...destructors) {
    if (!this._calledSuperInit) {
      throw new Error('protected function invoked before `await super.init()` call')
    }

    for (let destructor of destructors) {
      if (typeof destructor !== 'function') {
        throw new Error('$pushDestructor only accepts functions')
      }
      this._destroy.unshift(destructor)
    }
  }
}

exports.AsyncClass = AsyncClass
