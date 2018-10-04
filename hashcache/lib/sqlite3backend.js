const sqlite3 = require('./sqlite3')

/**
 */
class Sqlite3Backend {
  /**
   */
  constructor (db) {
    this._db = db
    this._ns = new Map()
  }

  /**
   */
  static async connect (opt) {
    opt || (opt = {})
    if (!opt.file) {
      throw new Error('cannot initialize a hashcache without a sqlite3 file')
    }

    return new Sqlite3Backend(await sqlite3.Db.connect(opt.file))
  }

  /**
   */
  async get (ns, hash) {
    ns = await this._assertTable(ns)
    const res = await ns.getter.get(Buffer.from(hash, 'base64'))
    if (!res) {
      throw new Error('no data at ' + hash)
    }
    return res.data
  }

  /**
   */
  async set (ns, hash, data) {
    ns = await this._assertTable(ns)
    await ns.setter.run(
      Buffer.from(hash, 'base64'),
      data)
  }

  // -- private -- //

  /**
   */
  async _assertTable (ns) {
    if (this._ns.has(ns)) {
      return this._ns.get(ns)
    }

    await this._db.run(`
      CREATE TABLE IF NOT EXISTS data_${ns} (
        hash BLOB PRIMARY KEY NOT NULL,
        data BLOB NOT NULL
      );
    `)

    this._ns.set(ns, {
      getter: await this._db.prepare(`
        SELECT hash, data
          FROM data_${ns}
          WHERE hash = ?1;
      `),
      setter: await this._db.prepare(`
        INSERT
          INTO data_${ns} (hash, data)
          VALUES (?1, ?2)
          ON CONFLICT (hash) DO UPDATE
            SET data = ?2;
      `)
    })

    return this._ns.get(ns)
  }
}

exports.Sqlite3Backend = Sqlite3Backend
