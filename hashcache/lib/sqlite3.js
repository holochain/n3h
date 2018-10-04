const sqlite3 = require('sqlite3')

/**
 * helper promisifier
 */
function $p (fn) {
  return new Promise((resolve, reject) => {
    try {
      fn((err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * Represents a prepared sqlite3 statement
 */
class Statement {
  /**
   * accepts the low-level statement instance
   */
  constructor (stmt) {
    this._stmt = stmt
  }

  /**
   * clean up the prepared statement
   */
  finalize () {
    return $p(cb => {
      this._stmt.finalize(cb)
    })
  }

  /**
   * run the prepared statement with parameters
   */
  run (...params) {
    return $p(cb => {
      this._stmt.run(...params, cb)
    })
  }

  /**
   * get a single row result of the prepared statement with parameters
   */
  get (...params) {
    return $p(cb => {
      this._stmt.get(...params, cb)
    })
  }

  /**
   * get multiple row results of the prepared statement with parameters
   */
  all (...params) {
    return $p(cb => {
      this._stmt.all(...params, cb)
    })
  }
}

/**
 * represents a sqlite3 database connection
 */
class Db {
  /**
   * don't use this directly, see `await connect()`
   */
  constructor (db) {
    this._db = db
    this._destroyed = false
  }

  /**
   * create a new sqlite3 database connection
   */
  static async connect (filename) {
    let _db = null
    await $p(cb => {
      _db = new sqlite3.Database(filename, cb)
    })
    _db.serialize()
    return new Db(_db)
  }

  /**
   * close the sqlite3 database connection
   */
  async close () {
    if (this._destroyed) {
      return
    }
    await $p(cb => {
      this._db.close(cb)
    })
    this._db = null
    this._destroyed = true
  }

  /**
   * prepare a sqlite3 database query
   */
  async prepare (sql, ...params) {
    this._checkDestroyed()
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

  // -- private -- //

  /**
   * throw an exception if we've been destroyed already
   */
  _checkDestroyed () {
    if (this._destroyed) {
      throw new Error('cannot use destroyed instance')
    }
  }
}

exports.Db = Db
