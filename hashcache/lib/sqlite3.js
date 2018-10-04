const sqlite3 = require('sqlite3')

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
 */
class Statement {
  /**
   */
  constructor (stmt) {
    this._stmt = stmt
  }

  /**
   */
  finalize () {
    return $p(cb => {
      this._stmt.finalize(cb)
    })
  }

  /**
   */
  run (...params) {
    return $p(cb => {
      this._stmt.run(...params, cb)
    })
  }

  /**
   */
  get (...params) {
    return $p(cb => {
      this._stmt.get(...params, cb)
    })
  }

  /**
   */
  all (...params) {
    return $p(cb => {
      this._stmt.all(...params, cb)
    })
  }
}

/**
 */
class Db {
  /**
   */
  constructor (db) {
    this._db = db
    this._destroyed = false
  }

  /**
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
   */
  async run (sql, ...params) {
    const s = await this.prepare(sql)
    await s.run(...params)
    await s.finalize()
  }

  /**
   */
  async get (sql, ...params) {
    const s = await this.prepare(sql)
    const out = await s.get(...params)
    await s.finalize()
    return out
  }

  /**
   */
  async all (sql, ...params) {
    const s = await this.prepare(sql)
    const out = await s.all(...params)
    await s.finalize()
    return out
  }

  // -- private -- //

  /**
   */
  _checkDestroyed () {
    if (this._destroyed) {
      throw new Error('cannot use destroyed instance')
    }
  }
}

exports.Db = Db
