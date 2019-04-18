## Functions

<dl>
<dt><a href="#encodeSign">encodeSign(signPub)</a> ⇒ <code>string</code></dt>
<dd><p>Generate an identity string with a public signing key</p>
</dd>
<dt><a href="#encodeEnc">encodeEnc(signPub)</a> ⇒ <code>string</code></dt>
<dd><p>Generate an identity string with a public encrypting key</p>
</dd>
<dt><a href="#decodeSign">decodeSign(id)</a> ⇒ <code>Buffer</code></dt>
<dd><p>Convert an identity string into a public signing key</p>
</dd>
<dt><a href="#decodeEnc">decodeEnc(id)</a> ⇒ <code>Buffer</code></dt>
<dd><p>Convert an identity string into a public encrypting key</p>
</dd>
<dt><a href="#verify">verify(signature, data, signerId)</a></dt>
<dd><p>verify a signature given the original data, and the signer&#39;s identity string</p>
</dd>
<dt><a href="#pwHash">pwHash(pass, [salt])</a> ⇒ <code>object</code></dt>
<dd><p>simplify the api for generating a password hash with our set parameters</p>
</dd>
<dt><a href="#pwEnc">pwEnc(data, passphrase)</a> ⇒ <code>Buffer</code></dt>
<dd><p>Helper for encrypting a buffer with a pwhash-ed passphrase</p>
</dd>
<dt><a href="#pwDec">pwDec(data, passphrase)</a> ⇒ <code>Buffer</code></dt>
<dd><p>Helper for decrypting a buffer with a pwhash-ed passphrase</p>
</dd>
</dl>

<a name="encodeSign"></a>

## encodeSign(signPub) ⇒ <code>string</code>
Generate an identity string with a public signing key

**Kind**: global function  
**Returns**: <code>string</code> - - the base32 encoded identity (with parity bytes)  

| Param | Type | Description |
| --- | --- | --- |
| signPub | <code>UInt8Array</code> | Public signing key |

<a name="encodeEnc"></a>

## encodeEnc(signPub) ⇒ <code>string</code>
Generate an identity string with a public encrypting key

**Kind**: global function  
**Returns**: <code>string</code> - - the base32 encoded identity (with parity bytes)  

| Param | Type | Description |
| --- | --- | --- |
| signPub | <code>UInt8Array</code> | Public encrypting key |

<a name="decodeSign"></a>

## decodeSign(id) ⇒ <code>Buffer</code>
Convert an identity string into a public signing key

**Kind**: global function  
**Returns**: <code>Buffer</code> - - Buffer holding the public signing key  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | the base32 encoded identity string |

<a name="decodeEnc"></a>

## decodeEnc(id) ⇒ <code>Buffer</code>
Convert an identity string into a public encrypting key

**Kind**: global function  
**Returns**: <code>Buffer</code> - - Buffer holding the public encrypting key  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | the base32 encoded identity string |

<a name="verify"></a>

## verify(signature, data, signerId)
verify a signature given the original data, and the signer's identity string

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| signature | <code>Buffer</code> | the binary signature |
| data | <code>Buffer</code> | the binary data to verify |
| signerId | <code>string</code> | the signer's public identity string |

<a name="pwHash"></a>

## pwHash(pass, [salt]) ⇒ <code>object</code>
simplify the api for generating a password hash with our set parameters

**Kind**: global function  
**Returns**: <code>object</code> - - { secret: SecBuf, salt: SecBuf }  

| Param | Type | Description |
| --- | --- | --- |
| pass | <code>SecBuf</code> | the password buffer to hash |
| [salt] | <code>Buffer</code> | if specified, hash with this salt (otherwise random) |

<a name="pwEnc"></a>

## pwEnc(data, passphrase) ⇒ <code>Buffer</code>
Helper for encrypting a buffer with a pwhash-ed passphrase

**Kind**: global function  
**Returns**: <code>Buffer</code> - - msgpack encoded of the encrypted data  

| Param | Type |
| --- | --- |
| data | <code>Buffer</code> | 
| passphrase | <code>SecBuf</code> | 

<a name="pwDec"></a>

## pwDec(data, passphrase) ⇒ <code>Buffer</code>
Helper for decrypting a buffer with a pwhash-ed passphrase

**Kind**: global function  
**Returns**: <code>Buffer</code> - - the decrypted data  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Buffer</code> | msgpack encoded of the encrypted data |
| passphrase | <code>string</code> |  |

