const Sqlite = require('better-sqlite3')

const fs = require('fs')

class DebugSnapshotState {
  constructor (file) {
    this._db = new Sqlite(file)

    // make sure we use the fast disk write method
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

    this.insert = this._db.transaction((...args) => {
      this._insert(...args)
    })

    this._casSelectAll = this._db.prepare(`SELECT * from cas`)
    this._casSelectOne = this._db.prepare(`SELECT * from cas WHERE hash = ?`)
    this._logSelectAll = this._db.prepare(`SELECT * from log ORDER BY epoch_ms, rowid`)

    this._checkpointTimer = setInterval(() => {
      this._db.checkpoint()
    }, 10000)
  }

  destroy () {
    clearInterval(this._checkpointTimer)
    this._checkpointTimer = null

    this._casInsert = null
    this._logInsert = null
    this.insert = null
    this._casSelectAll = null
    this._casSelectOne = null
    this._logSelectAll = null

    this._db.close()
    this._db = null
  }

  dump (streamWriter) {
    if (!streamWriter) {
      throw new Error('specify streamWriter `(x) => { console.log(x) }`')
    }

    streamWriter(this._header('BEGIN DEBUG SNAPSHOT DUMP'))

    for (let e of this._logSelectAll.iterate()) {
      streamWriter(`-- ${e.type} - ${(new Date(e.epoch_ms)).toISOString()} --`)
      const entry = JSON.parse(e.entry)
      for (let k in entry) {
        if (k.startsWith('$cas$')) {
          const casItem = this._casSelectOne.get([entry[k]])
          if (casItem) {
            entry[k] = casItem
          } else {
            entry[k] = '[not found] ' + entry[k]
          }
        }
      }
      streamWriter(JSON.stringify(entry, null, 2))
    }

    streamWriter(this._header('END DEBUG SNAPSHOT DUMP'))
  }

  // -- private -- //

  _header (msg) {
    return `
##############################################
# ${msg}
##############################################
`
  }

  _insert (casMap, logType, logEntry) {
    for (let hash in casMap) {
      this._casInsert.run(hash, JSON.stringify(
        casMap[hash], null, 2))
    }
    this._logInsert.run(Date.now(), logType, JSON.stringify(
      logEntry, null, 2))
  }
}

exports.DebugSnapshotState = DebugSnapshotState

let SINGLETON = null

exports.getDebugSnapshot = function getDebugSnapshot () {
  if (!SINGLETON) {
    // first, clear out any old debug snapshot logs
    for (let file of fs.readdirSync('.')) {
      if (file.startsWith('n3h-debug-snapshot-state-')) {
        try {
          fs.unlinkSync(file)
        } catch (e) { /* pass */ }
      }
    }

    SINGLETON = new DebugSnapshotState(`n3h-debug-snapshot-state-${Date.now()}.sqlite3`)
  }
  return SINGLETON
}
