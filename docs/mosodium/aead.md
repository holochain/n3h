## Functions

<dl>
<dt><a href="#enc">enc(message, secret, adata)</a> ⇒ <code>object</code></dt>
<dd><p>Generate symmetric cipher text given a message, secret, and optional auth data</p>
</dd>
<dt><a href="#dec">dec(nonce, cipher, secret, adata)</a> ⇒ <code>Buffer</code></dt>
<dd><p>Decrypt symmetric cipher text given a nonce, secret, and optional auth data</p>
</dd>
</dl>

<a name="enc"></a>

## enc(message, secret, adata) ⇒ <code>object</code>
Generate symmetric cipher text given a message, secret, and optional auth data

**Kind**: global function  
**Returns**: <code>object</code> - - { nonce, cipher }  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>Buffer</code> | data to encrypt |
| secret | <code>SecBuf</code> | symmetric secret key |
| adata | <code>Buffer</code> | optional additional authenticated data |

**Example**  
```js
const cipher = mosodium.aead.enc(Buffer.from('hello'), secret)
```
<a name="dec"></a>

## dec(nonce, cipher, secret, adata) ⇒ <code>Buffer</code>
Decrypt symmetric cipher text given a nonce, secret, and optional auth data

**Kind**: global function  
**Returns**: <code>Buffer</code> - - message  

| Param | Type | Description |
| --- | --- | --- |
| nonce | <code>Buffer</code> | sometimes called initialization vector (iv) |
| cipher | <code>Buffer</code> | the cipher text |
| secret | <code>SecBuf</code> | symmetric secret key |
| adata | <code>Buffer</code> | optional additional authenticated data |

**Example**  
```js
const message = mosodium.aead.dec(nonce, cipher, secret)
```
