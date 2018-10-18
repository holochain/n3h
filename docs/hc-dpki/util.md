## Functions

<dl>
<dt><a href="#encodeId">encodeId(signPub, encPub)</a> ⇒ <code>string</code></dt>
<dd><p>using base64url encoding (<a href="https://tools.ietf.org/html/rfc4648#section-5">https://tools.ietf.org/html/rfc4648#section-5</a>)
Generate an identity string with a pair of public keys</p>
</dd>
<dt><a href="#decodeId">decodeId(id)</a> ⇒ <code>object</code></dt>
<dd><p>using base64url encoding (<a href="https://tools.ietf.org/html/rfc4648#section-5">https://tools.ietf.org/html/rfc4648#section-5</a>)
break an identity string up into a pair of public keys</p>
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

<a name="encodeId"></a>

## encodeId(signPub, encPub) ⇒ <code>string</code>
using base64url encoding (https://tools.ietf.org/html/rfc4648#section-5)
Generate an identity string with a pair of public keys

**Kind**: global function  
**Returns**: <code>string</code> - - the base64url encoded identity (with checksum)  

| Param | Type | Description |
| --- | --- | --- |
| signPub | <code>Buffer</code> | singing public key |
| encPub | <code>Buffer</code> | encryption public key |

<a name="decodeId"></a>

## decodeId(id) ⇒ <code>object</code>
using base64url encoding (https://tools.ietf.org/html/rfc4648#section-5)
break an identity string up into a pair of public keys

**Kind**: global function  
**Returns**: <code>object</code> - - { signPub: Buffer, encPub: Buffer }  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | the base64url encoded identity string |

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
**Returns**: <code>object</code> - - { salt: Buffer, hash: SecBuf }  

| Param | Type | Description |
| --- | --- | --- |
| pass | <code>SecBuf</code> | the password buffer to hash |
| [salt] | <code>Buffer</code> | if specified, hash with this salt (otherwise random) |

<a name="pwEnc"></a>

## pwEnc(data, passphrase) ⇒ <code>Buffer</code>
Helper for encrypting a buffer with a pwhash-ed passphrase

**Kind**: global function  
**Returns**: <code>Buffer</code> - - the encrypted data  

| Param | Type |
| --- | --- |
| data | <code>Buffer</code> | 
| passphrase | <code>string</code> | 

<a name="pwDec"></a>

## pwDec(data, passphrase) ⇒ <code>Buffer</code>
Helper for decrypting a buffer with a pwhash-ed passphrase

**Kind**: global function  
**Returns**: <code>Buffer</code> - - the decrypted data  

| Param | Type |
| --- | --- |
| data | <code>Buffer</code> | 
| passphrase | <code>string</code> | 

