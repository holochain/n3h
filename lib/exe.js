const fs = require('fs')
const path = require('path')
const os = require('os')

const { mkdirp } = require('../lib/n3h-common')
const tweetlog = require('../lib/tweetlog')
const log = tweetlog('n3h-bin')

const { buildLogHandler } = require('../lib/file-logger')
const { N3hHackMode, N3hMock } = require('../lib/index')
const { unhandledRejection } = require('../lib/n3h-common')
unhandledRejection.strict()

async function main () {
  const workDir = 'N3H_WORK_DIR' in process.env
    ? process.env.N3H_WORK_DIR
    : path.resolve(path.join(
      os.homedir(), '.n3h'))

  // Move into working directory?
  await mkdirp(workDir)
  process.chdir(workDir)

  const logDir = path.join(workDir, 'logs')
  await mkdirp(logDir)

  const logHandler = buildLogHandler({
    dir: logDir
  })

  // Setup logging
  // Default to trace level
  tweetlog.set('t')
  // Check log level setting in env
  const hasLogLevel = 'N3H_LOG_LEVEL' in process.env
  if (hasLogLevel) {
    tweetlog.set(process.env.N3H_LOG_LEVEL)
  }
  tweetlog.listen(logHandler)

  const quietMode = 'N3H_QUIET' in process.env
  if (!quietMode) {
    tweetlog.listen((level, tag, ...args) => {
      args = args.map(a => {
        if (a instanceof Error) {
          return a.stack || a.toString()
        } else if (typeof a === 'object') {
          return JSON.stringify(a)
        }
        return a.toString()
      }).join(' ')
      console.error(`(${tag}) [${level}] ${args}`)
    })
  }

  let rawConfigData = null

  try {
    rawConfigData = JSON.parse((await _tryReadStdin()).toString())
    log.w('got stdin config!', rawConfigData)
  } catch (e) {
    log.w('could not read stdin', e)
  }

  if (!rawConfigData) {
    try {
      rawConfigData = JSON.parse(fs.readFileSync(path.resolve('n3h-config.json')))
    } catch (e) {
      log.w('failed to load config', e)
    }
  }

  let mode = 'HACK'

  // mode from config
  if (rawConfigData && 'mode' in rawConfigData) {
    mode = rawConfigData.mode
  }

  // environment mode override
  if ('N3H_MODE' in process.env) {
    mode = process.env.N3H_MODE
  }

  var n3hNode = null

  let terminated = false
  const terminate = async () => {
    if (terminated) {
      return
    }
    try {
      if (n3hNode) {
        await n3hNode.destroy()
      }
      log.i('n3h exited cleanly')
      await logHandler.cleanup()
      process.exit(0)
    } catch (e) {
      try {
        await logHandler.cleanup()
      } catch (e) { /* pass */ }
      log.e(e.stack || e.toString())
      process.exit(1)
    }
  }

  process.on('SIGINT', terminate)
  process.on('SIGTERM', terminate)
  process.on('unhandledRejection', err => {
    log.e(err)
    terminate()
  })

  log.i('executing mode ' + mode)
  switch (mode) {
    case 'MOCK':
      n3hNode = await new N3hMock(workDir, rawConfigData)
      break
    case 'HACK':
      n3hNode = await new N3hHackMode(workDir, rawConfigData)
      break
    default:
      log.e('so called "real" mode disabled while running POC on hackmode / mockmode')
      process.exit(1)
      // n3hNode = await N3hNode.constructDefault(workDir, rawConfigData)
      // break
  }

  await n3hNode.run()
}

exports.main = main

/**
 * read from stdin until closed
 * timeout if not read in 4 seconds
 */
async function _tryReadStdin () {
  const timeout = (new Error('timeout')).stack
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(timeout)
    }, 4000)

    log.w('attempting read stdin')
    process.stdin.resume()

    let data = Buffer.alloc(0)
    process.stdin.on('data', chunk => {
      data = Buffer.concat([data, chunk])
    })
    process.stdin.on('end', () => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}
