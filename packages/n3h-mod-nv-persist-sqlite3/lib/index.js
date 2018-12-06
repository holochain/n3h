const sqlite3 = require('./sqlite3')
const { AsyncClass } = require('@holochain/n3h-common')

/**
 * sqlite3 persistence engine for hashcache
 */
class NvPersistSqlite3 extends AsyncClass {
  static getDefinition () {
    return {
      type: 'nvPersist',
      name: 'sqlite3',
      defaultConfig: {
        '#file': 'what sqlite3 file should we use for persistence? (don\'t use \':memory:\' except for testing/debugging',
        file: 'n3h-persist.sqlite3'
      }
    }
  }

  /**
   */
  async init (config, system) {
    await super.init()

    this._config = config

    this._db = await new sqlite3.Db(this._config.file)
    this._ns = new Map()
    this.$pushDestructor(async () => {
      const wait = []
      for (let v of this._ns.values()) {
        wait.push(v.getter.destroy())
        wait.push(v.setter.destroy())
      }
      await Promise.all(wait)
      this._ns = null
      await this._db.destroy()
      this._db = null
    })
  }

  /**
   */
  async ready () {
    /* pass - we just initialize in init (no dependencies) */
  }

  /**
   * get a value from the database
   * @param {string} ns - the namespace
   * @param {Buffer} key - the binary key
   */
  async get (ns, key) {
    if (!(key instanceof Buffer)) {
      throw new Error('key must be a Buffer')
    }
    ns = await this._assertTable(ns)
    const res = await ns.getter.get(key)
    if (!res) {
      return null
    }
    return res.data
  }

  /**
   * set a value in the database
   * @param {string} ns - the namespace
   * @param {Buffer} hash - the binary key
   * @param {Buffer} data - the data to store
   */
  async set (ns, key, data) {
    if (!(key instanceof Buffer)) {
      throw new Error('key must be a Buffer')
    }
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer')
    }
    ns = await this._assertTable(ns)
    await ns.setter.run(
      key,
      data)
  }

  // -- private -- //

  /**
   * prepare a table and associated getter/setters
   * @private
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

exports.NvPersistSqlite3 = NvPersistSqlite3
