const { AsyncClass } = require('./async-class')
const { $sleep } = require('./sleep')

/**
 */
class Executor extends AsyncClass {
  /**
   */
  async init () {
    await super.init()

    this._schedules = new Map()
    this._queue = []
    this._continue = true
    this._destroyWait = new Promise((resolve, reject) => {
      this._destroyResolve = resolve
    })

    this.$pushDestructor(async () => {
      this._schedules.clear()
      this._continue = false
      await this._destroyWait
      this._queue = null
      this._destroyWait = null
      this._destroyResolve = null
    })

    this._run()
  }

  /**
   * post a new task to be emitted when it comes up in the queue
   * @param {*} task - the item to schedule
   */
  post (task) {
    if (this.$isDestroyed()) {
      return
    }

    this._queue.push(['t', task])
  }

  /**
   * tag the next spot in the queue
   * when that spot comes up, the promise returned by this function
   * will be resolved
   * @return {Promise}
   */
  drain () {
    if (this.$isDestroyed()) {
      return
    }

    return new Promise((resolve, reject) => {
      this._queue.push(['d', resolve])
    })
  }

  /**
   * schedule a recurring event timer
   * may not be accurate below 20 ms
   */
  schedule (name, ms) {
    if (this.$isDestroyed()) {
      return
    }

    if (this._schedules.has(name)) {
      throw new Error('schedule ' + name + ' already set')
    }

    this._schedules.set(name, [ms, Date.now()])
  }

  /**
   */
  unschedule (name) {
    this._schedules.delete(name)
  }

  // -- private -- //

  /**
   */
  async _run () {
    try {
      let waitMs = 0

      while (this._continue) {
        for (let [s, data] of this._schedules) {
          if (Date.now() - data[1] > data[0]) {
            data[1] = Date.now()
            this._queue.unshift(['s', s])
          }
        }

        if (this._queue.length) {
          waitMs = 0
          const task = this._queue.shift()

          switch (task[0]) {
            case 't':
              await this.emit('task', task[1])
              break
            case 's':
              await this.emit(task[1])
              break
            case 'd':
              task[1]()
              break
          }
        } else {
          waitMs += 1
          if (waitMs > 20) {
            waitMs = 20
          }
        }
        await $sleep(waitMs)
      }

      this._destroyResolve()
    } catch (e) {
      // too difficult to debug unhandled promise exceptions
      // hard fail
      console.error(e)
      process.exit(1)
    }
  }
}

exports.Executor = Executor
