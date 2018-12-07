# tweetlog

super light-weight logging abstraction

## Usage

```javascript
const tweetlog = require('@holochain/tweetlog')
tweetlog.set('e') // set general logging to error only
tweetlog.listen(tweetlog.console) // enable console output

const log = tweetlog('testlogger') // create a logger
tweetlog.set('t', 'testlogger') // set testlogger output to trace level

log.t('hello world')
// outputs: "(testlogger) [t] hello world"
```

## API

### Logging levels

```
t = trace
d = debug
i = info
w = warn
e = error
```

### Getting a logger

The tweetlog export is a function that takes a tag name and returns a logger object, this object will have 5 methods on it corresponding to the logging levels above.

```javascript
/**
 * @param {string} tag - logs produced with the resulting object will include this tag
 * @return {object} the logger object
 */
module.exports = function tweetlog (tag) { ... }
```

### Setting the logging level, either globally, or per-tag

```javascript
/**
 * @param {string} level - the single character log level to set
 * @param {string} [tag] - the optional logger tag to set
 */
tweetlog.set = function set (level, tag) { ... }
```

### Registering a log listener

```javascript
/**
 * @param {function} callback - the listener callback
 */
tweetlog.listen = function listen (callback) { ... }
```

callback signature:

```javascript
/**
 * @param {string} level - the single character log level for this message
 * @param {string} tag - the logger tag specified with this message
 * @param {*} ...items - everything logged by the implementor
 */
function callback (level, tag, ...items) { ... }
```

### The provided console listener

Tweetlog provides a listener that outputs log messages to the javascript console in the form `(tag) [level] <space separated messages>`.

```javascript
tweetlog.listen(tweetlog.console)
```

### Clear any registered log listeners or levels

```javasrcipt
/**
 */
tweetlog.clear = function clear () { ... }
```

### Check if a given level and tag would be logged

This is helpful if generating your log message is resource intensive.

```javascript
/**
 * @param {string} level - the single character log level to check
 * @param {string} tag - the logger tag to check
 * @return {boolean} - true if it would be logged
 */
tweetlog.should = function should (level, tag) { ... }
```

### Check if a level is greater than or equal to another level

```javascript
/**
 * @param {string} a - single character log level
 * @param {string} b - single character log level
 * @param {boolean} - true if a >= b
 */
tweetlog.gte = function gte (a, b) { ... }
```
