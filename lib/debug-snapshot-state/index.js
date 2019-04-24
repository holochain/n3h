const { AsyncClass } = require('../n3h-common')
const Sqlite = require('better-sqlite3')

class DebugSnapshotState extends AsyncClass {
  async init (file) {
    await super.init()

    this._db = new Sqlite(file)

    this._db.pragma('journal_mode = WAL')

    this._db.prepare(`CREATE TABLE IF NOT EXISTS cas (
      hash TEXT PRIMARY KEY UNIQUE NOT NULL,
      value TEXT NOT NULL
    )`).run()

    this._db.prepare(`CREATE TABLE IF NOT EXISTS log (
      epoch_ms INTEGER NOT NULL,
      type TEXT NOT NULL,
      entry TEXT NOT NULL
    )`).run()

    this._db.prepare(`CREATE INDEX IF NOT EXISTS log_epoch_ms_idx
      ON log (epoch_ms)`)

    this._casInsert = this._db.prepare(`INSERT OR IGNORE INTO cas (
      hash, value
    ) VALUES (?, ?)`)

    this._logInsert = this._db.prepare(`INSERT INTO log (
      epoch_ms, type, entry
    ) VALUES (?, ?, ?)`)

    this.insert = this._db.transaction((casMap, logType, logEntry) => {
      for (let hash in casMap) {
        this._casInsert.run(hash, JSON.stringify(
          casMap[hash], null, 2))
      }
      this._logInsert.run(Date.now(), logType, JSON.stringify(
        logEntry, null, 2))
    })

    this._casSelectAll = this._db.prepare(`SELECT * from cas`)
    this._logSelectAll = this._db.prepare(`SELECT * from log ORDER BY epoch_ms, rowid`)

    this.dump = () => ({
      cas: this._casSelectAll.all(),
      log: this._logSelectAll.all()
    })

    this._checkpointTimer = setInterval(() => {
      this._db.checkpoint()
    }, 10000)

    this.$pushDestructor(async () => {
      clearInterval(this._checkpointTimer)
      this._checkpointTimer = null

      this._casInsert = null
      this._logInsert = null
      this.insert = null
      this._casSelectAll = null
      this._logSelectAll = null
      this.dump = null

      this._db.close()
      this._db = null
    })
  }
}

exports.DebugSnapshotState = DebugSnapshotState
