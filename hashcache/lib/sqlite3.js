const sqlite3 = require('sqlite3')

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
    return new Promise((resolve, reject) => {
      try {
        this._stmt.finalize(err => {
          if (err) {
            return reject(err)
          }
          resolve()
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  /**
   */
  run (...params) {
    return new Promise((resolve, reject) => {
      try {
        this._stmt.run(...params, err => {
          if (err) {
            return reject(err)
          }
          resolve()
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  /**
   */
  get (...params) {
    return new Promise((resolve, reject) => {
      try {
        this._stmt.get(...params, (err, row) => {
          if (err) {
            return reject(err)
          }
          resolve(row)
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  /**
   */
  all (...params) {
    return new Promise((resolve, reject) => {
      try {
        this._stmt.all(...params, (err, rows) => {
          if (err) {
            return reject(err)
          }
          resolve(rows)
        })
      } catch (e) {
        reject(e)
      }
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
  static connect (filename, mode) {
    return new Promise((resolve, reject) => {
      try {
        const _db = new sqlite3.Database(filename, function (err) {
          if (err) {
            console.error(err)
            return reject(err)
          }
          _db.serialize()
          const out = new Db(_db)
          resolve(out)
        })
      } catch (e) {
        console.error(e)
        reject(e)
      }
    })
  }

  /**
   */
  close () {
    return new Promise((resolve, reject) => {
      try {
        if (this._destroyed) {
          return resolve()
        }
        this._db.close(err => {
          if (err) {
            return reject(err)
          }
          resolve()
        })
        this._db = null
        this._destroyed = true
      } catch (e) {
        reject(e)
      }
    })
  }

  /**
   */
  prepare (sql, ...params) {
    return new Promise((resolve, reject) => {
      try {
        this._checkDestroyed()
        const s = this._db.prepare(sql, ...params, err => {
          if (err) {
            return reject(err)
          }
          resolve(new Statement(s))
        })
      } catch (e) {
        reject(e)
      }
    })
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
