## Classes

<dl>
<dt><a href="#SBRoot">SBRoot</a></dt>
<dd><p>Abstract Base class for a buffer of a SecBuf
Buffer should be stored in _b
Expecting methods:</p>
<ul>
<li>async readable (fn)</li>
<li>async writable (fn)
fn: async function that takes the memory buffer as input</li>
</ul>
</dd>
<dt><a href="#SBSecure">SBSecure</a></dt>
<dd><p>SBRoot implementation with libsodium</p>
</dd>
<dt><a href="#SBInsecure">SBInsecure</a></dt>
<dd><p>SBRoot implementation with nodeJS Buffer</p>
</dd>
<dt><a href="#SBRef">SBRef</a></dt>
<dd><p>SBRoot implementation with a ref of a nodeJS Buffer</p>
</dd>
<dt><a href="#SecBuf">SecBuf</a></dt>
<dd><p>A protected SBRoot
Holds a SBRoot as _b</p>
</dd>
</dl>

<a name="SBRoot"></a>

## SBRoot
Abstract Base class for a buffer of a SecBuf
Buffer should be stored in _b
Expecting methods:
 - async readable (fn)
 - async writable (fn)
 fn: async function that takes the memory buffer as input

**Kind**: global class  

* [SBRoot](#SBRoot)
    * [.init()](#SBRoot+init)
    * [.size()](#SBRoot+size)

<a name="SBRoot+init"></a>

### sbRoot.init()
**Kind**: instance method of [<code>SBRoot</code>](#SBRoot)  
<a name="SBRoot+size"></a>

### sbRoot.size()
**Kind**: instance method of [<code>SBRoot</code>](#SBRoot)  
<a name="SBSecure"></a>

## SBSecure
SBRoot implementation with libsodium

**Kind**: global class  

* [SBSecure](#SBSecure)
    * [.init()](#SBSecure+init)
    * [.readable()](#SBSecure+readable)
    * [.writable()](#SBSecure+writable)

<a name="SBSecure+init"></a>

### sbSecure.init()
**Kind**: instance method of [<code>SBSecure</code>](#SBSecure)  
<a name="SBSecure+readable"></a>

### sbSecure.readable()
Make buffer readable than execute fn

**Kind**: instance method of [<code>SBSecure</code>](#SBSecure)  
<a name="SBSecure+writable"></a>

### sbSecure.writable()
Make buffer writable than execute fn

**Kind**: instance method of [<code>SBSecure</code>](#SBSecure)  
<a name="SBInsecure"></a>

## SBInsecure
SBRoot implementation with nodeJS Buffer

**Kind**: global class  

* [SBInsecure](#SBInsecure)
    * [.init()](#SBInsecure+init)
    * [.readable()](#SBInsecure+readable)
    * [.writable()](#SBInsecure+writable)

<a name="SBInsecure+init"></a>

### sbInsecure.init()
**Kind**: instance method of [<code>SBInsecure</code>](#SBInsecure)  
<a name="SBInsecure+readable"></a>

### sbInsecure.readable()
**Kind**: instance method of [<code>SBInsecure</code>](#SBInsecure)  
<a name="SBInsecure+writable"></a>

### sbInsecure.writable()
**Kind**: instance method of [<code>SBInsecure</code>](#SBInsecure)  
<a name="SBRef"></a>

## SBRef
SBRoot implementation with a ref of a nodeJS Buffer

**Kind**: global class  

* [SBRef](#SBRef)
    * [.init()](#SBRef+init)
    * [.readable()](#SBRef+readable)
    * [.writable()](#SBRef+writable)

<a name="SBRef+init"></a>

### sbRef.init()
**Kind**: instance method of [<code>SBRef</code>](#SBRef)  
<a name="SBRef+readable"></a>

### sbRef.readable()
**Kind**: instance method of [<code>SBRef</code>](#SBRef)  
<a name="SBRef+writable"></a>

### sbRef.writable()
**Kind**: instance method of [<code>SBRef</code>](#SBRef)  
<a name="SecBuf"></a>

## SecBuf
A protected SBRoot
Holds a SBRoot as _b

**Kind**: global class  

* [SecBuf](#SecBuf)
    * _instance_
        * [.init(backend)](#SecBuf+init)
        * [.size()](#SecBuf+size)
        * [.readable()](#SecBuf+readable)
        * [.writable()](#SecBuf+writable)
        * [.write()](#SecBuf+write)
        * [.randomize()](#SecBuf+randomize)
        * [.increment()](#SecBuf+increment)
        * [.compare()](#SecBuf+compare)
    * _static_
        * [.unlockMulti(spec, fn)](#SecBuf.unlockMulti)
        * [.secure()](#SecBuf.secure)
        * [.insecure()](#SecBuf.insecure)
        * [.ref()](#SecBuf.ref)
        * [.secureFrom()](#SecBuf.secureFrom)
        * [.insecureFrom()](#SecBuf.insecureFrom)

<a name="SecBuf+init"></a>

### secBuf.init(backend)
**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  

| Param | Description |
| --- | --- |
| backend | SBRoot backend |

<a name="SecBuf+size"></a>

### secBuf.size()
**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+readable"></a>

### secBuf.readable()
**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+writable"></a>

### secBuf.writable()
**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+write"></a>

### secBuf.write()
Write oth buffer inside this buffer starting at offset

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+randomize"></a>

### secBuf.randomize()
randomize the underlying buffer

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+increment"></a>

### secBuf.increment()
sodium_increment

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf+compare"></a>

### secBuf.compare()
return sodium_compare(this, oth)

**Kind**: instance method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf.unlockMulti"></a>

### SecBuf.unlockMulti(spec, fn)
Helper for unlocking multiple secbufs and applying a function to them

**Kind**: static method of [<code>SecBuf</code>](#SecBuf)  

| Param | Description |
| --- | --- |
| spec | array of (secBuf, 'readable|writeable') |
| fn | async function to process for each secBuf in spec |

<a name="SecBuf.secure"></a>

### SecBuf.secure()
Create a new SecBuf with a SBSecure

**Kind**: static method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf.insecure"></a>

### SecBuf.insecure()
Create a new SecBuf with a SBInsecure

**Kind**: static method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf.ref"></a>

### SecBuf.ref()
Create a new SecBuf out of oth

**Kind**: static method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf.secureFrom"></a>

### SecBuf.secureFrom()
Create a new secure SecBuf out of oth

**Kind**: static method of [<code>SecBuf</code>](#SecBuf)  
<a name="SecBuf.insecureFrom"></a>

### SecBuf.insecureFrom()
Create a new insecure SecBuf out of oth

**Kind**: static method of [<code>SecBuf</code>](#SecBuf)  
