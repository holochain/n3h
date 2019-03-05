const { AsyncClass } = require('./async-class')
const noop = () => {}

/**
 * In network communication code, we often have the need to correlate
 * messages by an identifier that is returned to us.
 * This class helps us treat messages of this nature as promises
 * to streamline the code implementors will work with
 *
 * @param {object} [opts]
 * @param {number} [opts.timeout] timeout in ms for promise fulfillment
 *
 * @example
 *
 * const t = await new Track({ timeout: 2000 })
 *
 * async function sendMessage(data) {
 *   const id = Math.random()
 *   send(id, data)
 *   return t.track(id)
 * }
 *
 * async function handleMessage(id, data) {
 *   t.resolve(id, data)
 * }
 */
class Track extends AsyncClass {
  /**
   * see class description for constructor arguments
   */
  async init (opts) {
    await super.init()

    opts || (opts = {})

    this._timeout = typeof opts.timeout === 'number' ? opts.timeout : 5000

    this._wait = new Map()

    this.$pushDestructor(() => {
      for (let r of this._wait.values()) {
        r.reject(new Error('destroying'))
      }
      this._wait.clear()
      this._wait = null
    })
  }

  /**
   * are we already tracking this id?
   * @param {string} id - the id to check
   */
  has (id) {
    return this._wait.has(id)
  }

  /**
   */
  get (id) {
    if (!this._wait.has(id)) {
      throw new Error(id + ' not registered')
    }
    return this._wait.get(id).promise
  }

  /**
   * obtain a promise that will be resolved / rejected based on `id`
   * @param {string} id - the id to track this promise
   */
  async track (id) {
    if (this._wait.has(id)) {
      throw new Error(id + ' already registered')
    }
    const timeoutStack = (new Error('timeout')).stack
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        r.reject(timeoutStack)
      }, this._timeout)
      const cleanup = () => {
        r.resolve = noop
        r.reject = noop
        clearTimeout(timer)
        this._wait.delete(id)
      }
      const r = {
        resolve: (...args) => {
          cleanup()
          resolve(...args)
        },
        reject: err => {
          cleanup()
          reject(err)
        }
      }
      this._wait.set(id, r)
    })
    this._wait.get(id).promise = promise
    return promise
  }

  /**
   * resolve a promise with `args` based on `id`
   * @param {string} id - the id to resolve
   * @param {*} ...args - args will be passed to resolve()
   */
  async resolve (id, ...args) {
    if (!this._wait.has(id)) {
      return
    }
    this._wait.get(id).resolve(...args)
  }

  /**
   * reject a promise with `err` based on `id`
   * @param {string} id - the id to resolve
   * @param {Error} err - err will be passed to reject()
   */
  async reject (id, err) {
    if (!this._wait.has(id)) {
      return
    }
    this._wait.get(id).reject(err)
  }
}

exports.Track = Track
