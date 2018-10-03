## Functions

<dl>
<dt><a href="#toInt">toInt(input)</a> ⇒ <code>number</code></dt>
<dd><p>XOR an arbitrary length buffer (byteLength must be a multiple of 4)
into an int32 sized javascript number</p>
</dd>
<dt><a href="#sha256">sha256(input)</a> ⇒ <code>Buffer</code></dt>
<dd><p>Compute the sha256 hash of input buffer</p>
</dd>
<dt><a href="#sha512">sha512(input)</a> ⇒ <code>Buffer</code></dt>
<dd><p>Compute the sha512 hash of input buffer</p>
</dd>
</dl>

<a name="toInt"></a>

## toInt(input) ⇒ <code>number</code>
XOR an arbitrary length buffer (byteLength must be a multiple of 4)
into an int32 sized javascript number

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>Buffer</code> | the data to xor |

**Example**  
```js
const myInt = mosodium.hash.toInt(mosodium.hash.sha256(Buffer.from('hello')))
```
<a name="sha256"></a>

## sha256(input) ⇒ <code>Buffer</code>
Compute the sha256 hash of input buffer

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>Buffer</code> | the data to hash |

**Example**  
```js
const hash = mosodium.hash.sha256(Buffer.from('hello'))
```
<a name="sha512"></a>

## sha512(input) ⇒ <code>Buffer</code>
Compute the sha512 hash of input buffer

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>Buffer</code> | the data to hash |

**Example**  
```js
const hash = mosodium.hash.sha512(Buffer.from('hello'))
```
