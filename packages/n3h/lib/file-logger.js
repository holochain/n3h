const fs = require('fs')
const path = require('path')

const RE_PATH = /[\\/]/

/**
 * Construct a tweetlog log listener that will write to rotating files
 * @param {object} [opts]
 * @param {string} [opts.dir] - defaults to '.'
 * @param {string} [opts.prefix] - defaults to ''
 * @param {string} [opts.suffix] - defaults to '.n3h.log'
 * @param {number} [opts.rotateMs] - rotate log files at this frequency, defaults to 1 hour
 * @param {number} [opts.keepCount] - keep this count log files, defaults to 4
 * @param {number} [opts.flushMs] - flush to file system at this frequency, defaults to 0, if <= 0, flush on every log
 */
exports.buildLogHandler = opts => {
  opts || (opts = {})
  const dir = opts.dir || '.'
  const prefix = opts.prefix || ''
  const suffix = opts.suffix || '.n3h.log'
  const rotateMs = opts.rotateMs || (1000 * 60 * 60)
  const keepCount = opts.keepCount || 4
  // const flushMs = opts.flushMs || 0

  if (RE_PATH.test(prefix) || RE_PATH.test(suffix)) {
    throw new Error('prefix / suffix cannot contain path elements')
  }

  const runtime = {
    lastFlush: 0,
    timeTag: 0,
    stream: null
  }

  const cleanup = () => {
    if (runtime.stream) {
      runtime.stream.end()
    }
    runtime.lastFlush = 0
    runtime.timeTag = 0
    runtime.stream = null
  }

  const listener = (level, tag, ...args) => {
    const timeTag = parseInt(Date.now() / rotateMs, 10) * rotateMs

    if (timeTag !== runtime.timeTag) {
      // fire off asynchronous prune
      (async () => {
        let list = fs.readdirSync(dir)
        list = list.filter(n => n.startsWith(prefix) && n.endsWith(suffix))
        list.sort((a, b) => {
          a = parseInt(a.replace(prefix, '').replace(suffix, ''), 10)
          b = parseInt(b.replace(prefix, '').replace(suffix, ''), 10)
          return a - b
        })
        for (let i = 0; i < keepCount - 1; ++i) {
          list.pop()
        }
        for (let file of list) {
          file = path.join(dir, file)
          fs.unlinkSync(file)
        }
      })().catch(err => {
        console.error('LOGGING ERROR', err)
      })

      // close any old handle
      cleanup()

      const filename = path.join(dir, prefix + timeTag + suffix)

      runtime.stream = fs.createWriteStream(
        filename,
        {
          flags: 'a'
        }
      )
    }

    runtime.stream.write(`~*~ ${_renderTime()} (${tag}) [${level}] ${_renderArgs(args)}\n`)
  }

  listener.cleanup = cleanup

  return listener
}

/**
 */
function _renderTime () {
  return (new Date()).toLocaleString() + ' - ' + Date.now()
}

/**
 */
function _renderArgs (args) {
  return args.map(a => {
    if (a instanceof Error) {
      return a.stack || a.toString()
    } else if (typeof a === 'object') {
      return JSON.stringify(a)
    }
    return a.toString()
  }).join('\n')
}
