## Classes

<dl>
<dt><a href="#SecBuf">SecBuf</a></dt>
<dd><p>Wrap libsodium memory lock and protect functions.
Some nodejs buffer accessors may invalidate security.</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#LockLevel">LockLevel</a></dt>
<dd><p>SecBuf Lock styles</p>
</dd>
</dl>

<a name="SecBuf"></a>

## SecBuf
Wrap libsodium memory lock and protect functions.
Some nodejs buffer accessors may invalidate security.

**Kind**: global class  

* [SecBuf](#SecBuf)
    * [new SecBuf(len)](#new_SecBuf_new)
    * _instance_
        * [.size()](#SecBuf+size)
        * [.lockLevel()](#SecBuf+lockLevel) ⇒ <code>string</code>
        * [.free()](#SecBuf+free)
        * [.randomize()](#SecBuf+randomize)
        * [.readable(fn)](#SecBuf+readable)
        * [.writable(fn)](#SecBuf+writable)
        * [.$makeReadable()](#SecBuf+$makeReadable)
        * [.$makeWritable()](#SecBuf+$makeWritable)
        * [.$restoreProtection()](#SecBuf+$restoreProtection)
    * _static_
        * [.setLockLevel(lockLevel)](#SecBuf.setLockLevel)
        * [.readPrompt(promptText)](#SecBuf.readPrompt) ⇒ [<code>SecBuf</code>](#SecBuf)
        * [.from(buffer)](#SecBuf.from)

<a name="new_SecBuf_new"></a>

### new SecBuf(len)
create a new SecBuf with specified length


| Param | Type | Description |
| --- | --- | --- |
| len | <code>number</code> | the byteLength of the new SecBuf |

**Example**  
```js
const sb = new mosodium.SecBuf(32)
const sb = new mosodium.SecBuf(32, SecBuf.LOCK_NONE)
const sb = new mosodium.SecBuf(32, SecBuf.LOCK_MEM)
const sb = new mosodium.SecBuf(32, SecBuf.LOCK_ALL)
```
<a name="SecBuf+size"></a>

### secBuf.size()
**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+lockLevel"></a>

### secBuf.lockLevel() ⇒ <code>string</code>
get current mlock/mprotect level

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
**Returns**: <code>string</code> - the SecBuf.LOCK_* level this SecBuf is using  
<a name="SecBuf+free"></a>

### secBuf.free()
zero out the memory and release the memory protection / lock

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+randomize"></a>

### secBuf.randomize()
randomize the underlying buffer

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+readable"></a>

### secBuf.readable(fn)
this SecBuf instance will be readable for the duration of the callback

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | the function to invoke |

**Example**  
```js
sb.readable(_sb => {
  console.log(_sb)
})
```
<a name="SecBuf+writable"></a>

### secBuf.writable(fn)
this SecBuf instance will be writable for the duration of the callback

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | the function to invoke |

**Example**  
```js
sb.writable(_sb => {
  _sb.writeUInt8(0, 0)
})
```
<a name="SecBuf+$makeReadable"></a>

### secBuf.$makeReadable()
make buffer readable indefinately... prefer #readable()

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+$makeWritable"></a>

### secBuf.$makeWritable()
make buffer writable indefinately... prefer #writable()

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+$restoreProtection"></a>

### secBuf.$restoreProtection()
restore memory protection `mprotect_noaccess`

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf.setLockLevel"></a>

### SecBuf.setLockLevel(lockLevel)
**Kind**: static method of [<code>SecBuf</code>](#SecBuf)  

| Param | Type | Description |
| --- | --- | --- |
| lockLevel | <code>string</code> | the SecBuf.LOCK_* level for all generated SecBufs |

<a name="SecBuf.readPrompt"></a>

### SecBuf.readPrompt(promptText) ⇒ [<code>SecBuf</code>](#SecBuf)
Fetch a buffer from stdin into a SecBuf.

**Kind**: static method of [<code>SecBuf</code>](#SecBuf)  

| Param | Type | Description |
| --- | --- | --- |
| promptText | <code>string</code> | displayed to stderr before awaiting input |

**Example**  
```js
const passphrase = await mosodium.SecBuf.readPrompt('passphrase (no echo): ')
```
<a name="SecBuf.from"></a>

### SecBuf.from(buffer)
create a new SecBuf based off a source buffer
attempts to clear the source buffer

**Kind**: static method of [<code>SecBuf</code>](#SecBuf)  

| Param | Type | Description |
| --- | --- | --- |
| buffer | <code>Buffer</code> | the buffer to copy then destroy |

<a name="LockLevel"></a>

## LockLevel
SecBuf Lock styles

**Kind**: global constant  
