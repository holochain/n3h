const sqlite3 = require('sqlite3')

const {
  AsyncClass,
  $p
} = require('n3h-common')

/**
 * Represents a prepared sqlite3 statement
 */
class Statement extends AsyncClass {
  /**
   * accepts the low-level statement instance
   */
  constructor (stmt) {
    super()

    return AsyncClass.$construct(this, async (self) => {
      self._stmt = stmt
      self.$pushDestructor(async () => {
        await self._stmt.finalize()
        self._stmt = null
      })
      return self
    })
  }

  /**
   * clean up the prepared statement
   */
  finalize () {
    this.$checkDestroyed()
    return $p(cb => {
      this._stmt.finalize(cb)
    })
  }

  /**
   * run the prepared statement with parameters
   */
  run (...params) {
    this.$checkDestroyed()
    return $p(cb => {
      this._stmt.run(...params, cb)
    })
  }

  /**
   * get a single row result of the prepared statement with parameters
   */
  get (...params) {
    this.$checkDestroyed()
    return $p(cb => {
      this._stmt.get(...params, cb)
    })
  }

  /**
   * get multiple row results of the prepared statement with parameters
   */
  all (...params) {
    this.$checkDestroyed()
    return $p(cb => {
      this._stmt.all(...params, cb)
    })
  }
}

/**
 * represents a sqlite3 database connection
 */
class Db extends AsyncClass {
  /**
   * create a new sqlite3 database connection
   */
  constructor (filename) {
    super()

    return AsyncClass.$construct(this, async (self) => {
      self._db = null
      await $p(cb => {
        self._db = new sqlite3.Database(filename, cb)
      })
      self._db.serialize()

      self.$pushDestructor(async () => {
        await $p(cb => {
          self._db.close(cb)
        })
        self._db = null
      })

      return self
    })
  }

  /**
   * prepare a sqlite3 database query
   */
  async prepare (sql, ...params) {
    this.$checkDestroyed()
    let s = null
    await $p(cb => {
      s = this._db.prepare(sql, ...params, cb)
    })
    return new Statement(s)
  }

  /**
   * prepare, execute, and cleanup a sqlite3 database query (no results)
   */
  async run (sql, ...params) {
    const s = await this.prepare(sql)
    await s.run(...params)
    await s.finalize()
  }

  /**
   * prepare, execute, and cleanup a sqlite3 database query (one row result)
   */
  async get (sql, ...params) {
    const s = await this.prepare(sql)
    const out = await s.get(...params)
    await s.finalize()
    return out
  }

  /**
   * prepare, execute, and cleanup a sqlite3 database query (all row results)
   */
  async all (sql, ...params) {
    const s = await this.prepare(sql)
    const out = await s.all(...params)
    await s.finalize()
    return out
  }
}

exports.Db = Db
