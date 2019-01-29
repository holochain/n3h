<a name="module_tweetlog"></a>

## tweetlog ⇒ <code>Logger</code>
A bare-bones logging helper for light-weight javascript logging.
This module itself is a function that returns a logger instance
when given a tag.

tweetlog (without api comments / tests) currently fits into 5 tweets.
Homage to https://tweetnacl.cr.yp.to/


| Param | Type | Description |
| --- | --- | --- |
| tag | <code>string</code> | a logging tag to mark messages |

**Example**  
```js
const tweetlog = require('tweetlog')
tweetlog.listen(tweetlog.console)
const log = tweetlog('my-log')
log.e('circumstance a', new Error('something bad'))
```

* [tweetlog](#module_tweetlog) ⇒ <code>Logger</code>
    * _static_
        * [.Logger](#module_tweetlog.Logger) : <code>object</code>
            * [.tag](#module_tweetlog.Logger+tag)
            * [.t(...args)](#module_tweetlog.Logger+t)
            * [.d(...args)](#module_tweetlog.Logger+d)
            * [.i(...args)](#module_tweetlog.Logger+i)
            * [.w(...args)](#module_tweetlog.Logger+w)
            * [.e(...args)](#module_tweetlog.Logger+e)
    * _inner_
        * [~console(level, tag, ...args)](#module_tweetlog..console)
        * [~set(level, [tag])](#module_tweetlog..set)
        * [~listen(listener)](#module_tweetlog..listen)
        * [~unlisten(listener)](#module_tweetlog..unlisten)
        * [~unlistenAll()](#module_tweetlog..unlistenAll)
        * [~resetLevels()](#module_tweetlog..resetLevels)
        * [~gte(a, b)](#module_tweetlog..gte) ⇒ <code>boolean</code>
        * [~should(level, [tag])](#module_tweetlog..should) ⇒ <code>boolean</code>

<a name="module_tweetlog.Logger"></a>

### tweetlog.Logger : <code>object</code>
A tagged logger instance

**Kind**: static namespace of [<code>tweetlog</code>](#module_tweetlog)  

* [.Logger](#module_tweetlog.Logger) : <code>object</code>
    * [.tag](#module_tweetlog.Logger+tag)
    * [.t(...args)](#module_tweetlog.Logger+t)
    * [.d(...args)](#module_tweetlog.Logger+d)
    * [.i(...args)](#module_tweetlog.Logger+i)
    * [.w(...args)](#module_tweetlog.Logger+w)
    * [.e(...args)](#module_tweetlog.Logger+e)

<a name="module_tweetlog.Logger+tag"></a>

#### logger.tag
The tag this logger instance was created with.

**Kind**: instance property of [<code>Logger</code>](#module_tweetlog.Logger)  
<a name="module_tweetlog.Logger+t"></a>

#### logger.t(...args)
Log a message at trace (t) level

**Kind**: instance method of [<code>Logger</code>](#module_tweetlog.Logger)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | any log message parameters |

<a name="module_tweetlog.Logger+d"></a>

#### logger.d(...args)
Log a message at debug (d) level

**Kind**: instance method of [<code>Logger</code>](#module_tweetlog.Logger)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | any log message parameters |

<a name="module_tweetlog.Logger+i"></a>

#### logger.i(...args)
Log a message at info (i) level

**Kind**: instance method of [<code>Logger</code>](#module_tweetlog.Logger)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | any log message parameters |

<a name="module_tweetlog.Logger+w"></a>

#### logger.w(...args)
Log a message at warn (w) level

**Kind**: instance method of [<code>Logger</code>](#module_tweetlog.Logger)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | any log message parameters |

<a name="module_tweetlog.Logger+e"></a>

#### logger.e(...args)
Log a message at error (e) level

**Kind**: instance method of [<code>Logger</code>](#module_tweetlog.Logger)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | any log message parameters |

<a name="module_tweetlog..console"></a>

### tweetlog~console(level, tag, ...args)
A log listener callback handler that logs to the javascript console.
Logs at level info or less will be `console.log`-ed.
Logs at level warning or greater will be `console.error`-ed if available.

**Kind**: inner method of [<code>tweetlog</code>](#module_tweetlog)  

| Param | Type | Description |
| --- | --- | --- |
| level | <code>string</code> | single character log level (one of 'tdiwe') |
| tag | <code>string</code> | the logger tag |
| ...args | <code>\*</code> | any log message parameters |

<a name="module_tweetlog..set"></a>

### tweetlog~set(level, [tag])
Set a global logging level, or a level for a specific tag.

**Kind**: inner method of [<code>tweetlog</code>](#module_tweetlog)  

| Param | Type | Description |
| --- | --- | --- |
| level | <code>string</code> | a single character logging level (one of 'tdiwe') |
| [tag] | <code>string</code> | the tag, if setting a tag specific level |

<a name="module_tweetlog..listen"></a>

### tweetlog~listen(listener)
Register a log listener / aggregator to handle log messages.
For a simple console logging example, see the included `tweetlog.console`

**Kind**: inner method of [<code>tweetlog</code>](#module_tweetlog)  

| Param | Type | Description |
| --- | --- | --- |
| listener | <code>function</code> | the listener callback |

**Example**  
```js
const tweetlog = require('tweetlog')
tweetlog.listen(tweetlog.console)
```
<a name="module_tweetlog..unlisten"></a>

### tweetlog~unlisten(listener)
Unregister a previously registered log listener.

**Kind**: inner method of [<code>tweetlog</code>](#module_tweetlog)  

| Param | Type | Description |
| --- | --- | --- |
| listener | <code>function</code> | the listener callback to remove |

<a name="module_tweetlog..unlistenAll"></a>

### tweetlog~unlistenAll()
Unregister all previously registered log listeners.

**Kind**: inner method of [<code>tweetlog</code>](#module_tweetlog)  
<a name="module_tweetlog..resetLevels"></a>

### tweetlog~resetLevels()
Set global log level to info (i) and remove all tag overrides.

**Kind**: inner method of [<code>tweetlog</code>](#module_tweetlog)  
<a name="module_tweetlog..gte"></a>

### tweetlog~gte(a, b) ⇒ <code>boolean</code>
**Kind**: inner method of [<code>tweetlog</code>](#module_tweetlog)  
**Returns**: <code>boolean</code> - - true if a is >= b  

| Param | Type | Description |
| --- | --- | --- |
| a | <code>string</code> | single character log level (one of 'tdiwe') |
| b | <code>string</code> | single character log level (one of 'tdiwe') |

<a name="module_tweetlog..should"></a>

### tweetlog~should(level, [tag]) ⇒ <code>boolean</code>
Given a log level and tag, determine if logger would log this level.
Can be used to short-circuit computationally intensive logging.

**Kind**: inner method of [<code>tweetlog</code>](#module_tweetlog)  
**Returns**: <code>boolean</code> - if this log would be logged  

| Param | Type | Description |
| --- | --- | --- |
| level | <code>string</code> | single character log level (one of 'tdiwe') |
| [tag] | <code>string</code> | the tag to check, or global if unspecified |

**Example**  
```js
const tweetlog = require('tweetlog')
const log = tweetlog('my-log')
if (tweetlog.should('e', log.tag)) {
  log.e(... some cpu intensive logging ...)
}
```
