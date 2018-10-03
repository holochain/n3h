const sqlite3 = require('./sqlite3')

/**
 */
class Sqlite3Backend {
  /**
   */
  constructor (db, getter, setter) {
    this._db = db
    this._getter = getter
    this._setter = setter
  }

  /**
   */
  static async connect (opt) {
    opt || (opt = {})
    if (!opt.file) {
      throw new Error('cannot initialize a hashcache without a sqlite3 file')
    }

    const db = await sqlite3.Db.connect(opt.file)

    await db.run(`
CREATE TABLE IF NOT EXISTS data (
  hash BLOB PRIMARY KEY NOT NULL,
  data BLOB NOT NULL
);
`)

    return new Sqlite3Backend(
      db,
      await db.prepare(`
SELECT hash, data
  FROM data
  WHERE hash = ?1;
`),
      await db.prepare(`
INSERT
  INTO data (hash, data)
  VALUES (?1, ?2)
  ON CONFLICT (hash) DO UPDATE
    SET data = ?2
`)
    )
  }

  /**
   */
  async get (hash) {
    const res = await this._getter.get(Buffer.from(hash, 'base64'))
    if (!res) {
      throw new Error('no data at ' + hash)
    }
    return res.data.toString('utf8')
  }

  /**
   */
  async set (hash, data) {
    return this._setter.run(
      Buffer.from(hash, 'base64'),
      Buffer.from(data, 'utf8'))
  }
}

exports.Sqlite3Backend = Sqlite3Backend
