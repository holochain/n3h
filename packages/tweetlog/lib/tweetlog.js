/**
 * A bare-bones logging helper for light-weight javascript logging.
 * This module itself is a function that returns a logger instance
 * when given a tag.
 *
 * tweetlog (without api comments / tests) currently fits into 5 tweets.
 * Homage to https://tweetnacl.cr.yp.to/
 *
 * @module tweetlog
 * @param {string} tag - a logging tag to mark messages
 * @return {Logger}
 * @example
 *
 * const tweetlog = require('tweetlog')
 * tweetlog.listen(tweetlog.console)
 * const log = tweetlog('my-log')
 * log.e('circumstance a', new Error('something bad'))
 */

/**
 * A tagged logger instance
 * @namespace Logger
 * @memberof module:tweetlog
 */

/**
 * The tag this logger instance was created with.
 * @member tag
 * @memberof module:tweetlog.Logger#
 */

/**
 * Log a message at trace (t) level
 * @function t
 * @memberof module:tweetlog.Logger#
 * @param {...*} args - any log message parameters
 */

/**
 * Log a message at debug (d) level
 * @function d
 * @memberof module:tweetlog.Logger#
 * @param {...*} args - any log message parameters
 */

/**
 * Log a message at info (i) level
 * @function i
 * @memberof module:tweetlog.Logger#
 * @param {...*} args - any log message parameters
 */

/**
 * Log a message at warn (w) level
 * @function w
 * @memberof module:tweetlog.Logger#
 * @param {...*} args - any log message parameters
 */

/**
 * Log a message at error (e) level
 * @function e
 * @memberof module:tweetlog.Logger#
 * @param {...*} args - any log message parameters
 */

/**
 * A log listener callback handler that logs to the javascript console.
 * Logs at level info or less will be `console.log`-ed.
 * Logs at level warning or greater will be `console.error`-ed if available.
 * @function console
 * @param {string} level - single character log level (one of 'tdiwe')
 * @param {string} tag - the logger tag
 * @param {...*} args - any log message parameters
 */

/**
 * Set a global logging level, or a level for a specific tag.
 * @function set
 * @param {string} level - a single character logging level (one of 'tdiwe')
 * @param {string} [tag] - the tag, if setting a tag specific level
 */

/**
 * Register a log listener / aggregator to handle log messages.
 * For a simple console logging example, see the included `tweetlog.console`
 * @function listen
 * @param {function} listener - the listener callback
 * @example
 *
 * const tweetlog = require('tweetlog')
 * tweetlog.listen(tweetlog.console)
 */

/**
 * Unregister a previously registered log listener.
 * @function unlisten
 * @param {function} listener - the listener callback to remove
 */

/**
 * Unregister all previously registered log listeners.
 * @function unlistenAll
 */

/**
 * Set global log level to info (i) and remove all tag overrides.
 * @function resetLevels
 */

/**
 * @function gte
 * @param {string} a - single character log level (one of 'tdiwe')
 * @param {string} b - single character log level (one of 'tdiwe')
 * @return {boolean} - true if a is >= b
 */

/**
 * Given a log level and tag, determine if logger would log this level.
 * Can be used to short-circuit computationally intensive logging.
 * @function should
 * @param {string} level - single character log level (one of 'tdiwe')
 * @param {string} [tag] - the tag to check, or global if unspecified
 * @return {boolean} if this log would be logged
 * @example
 *
 * const tweetlog = require('tweetlog')
 * const log = tweetlog('my-log')
 * if (tweetlog.should('e', log.tag)) {
 *   log.e(... some cpu intensive logging ...)
 * }
 */

// -- begin tweetlog -- //
const _ = { t: 1, d: 2, i: 3, w: 4, e: 5 }
const $ = []
let c = { _: 'i' }
const e = (...a) => {
  for (let l of $) {
    try { l(...a) } catch (e) {}
  }
}
// --
const f = module.exports = (t) => {
  const o = { tag: t }
  ;['t', 'd', 'i', 'w', 'e'].forEach((l) => {
    o[l] = (...a) => {
      if (!f.should(l, t)) return
      e(l, t, ...a)
    }
  })
  return o
}
// --
f.set = (l, t) => {
  c[t || '_'] = l
}
f.listen = $.push.bind($)
f.unlisten = l => {
  const i = $.indexOf(l)
  i > -1 && $.splice(i, 1)
}
f.unlistenAll = () => {
  $.splice(0)
}
f.resetLevels = () => {
  c = { _: 'i' }
}
// --
f.gte = (a, b) => {
  return _[a] >= _[b]
}
f.should = (l, t) => {
  return f.gte(l, c.t || c._)
}
const $l = console.log.bind(console)
const $e = console.error ? console.error.bind(console) : $l
// --
f.console = (l, t, ...a) => {
  (f.gte(l, 'w') ? $e : $l)(`(${t}) [${l}] ${a.map((a) => a.stack || a.toString()).join(' ')}`)
}
// -- end tweetlog -- //
