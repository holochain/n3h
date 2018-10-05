const fs = require('fs')
const path = require('path')

const { $p } = require('./promisify')

/**
 */
exports.mkdirp = async function mkdirp (p, exit) {
  p = path.resolve(p)
  try {
    await $p(cb => {
      exports.mkdirp.fs.mkdir(p, cb)
    })
  } catch (e) {
    if (!exit && e.code === 'ENOENT') {
      await exports.mkdirp(path.dirname(p))
      await exports.mkdirp(p, true)
    } else {
      const s = await $p(cb => {
        exports.mkdirp.fs.stat(p, cb)
      })
      if (!s.isDirectory()) {
        throw e
      }
    }
  }
}

exports.mkdirp.fs = fs
