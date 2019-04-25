## Functions

<dl>
<dt><a href="#aeadEnc">aeadEnc(nonce, message, secret, [adata])</a> ⇒ <code>Buffer</code></dt>
<dd><p>Generate symmetric cipher text given a message, secret, and optional auth data</p>
</dd>
<dt><a href="#aeadDec">aeadDec(message, nonce, cipher, secret, [adata])</a></dt>
<dd><p>Decrypt symmetric cipher text given a nonce, secret, and optional auth data</p>
</dd>
</dl>

<a name="aeadEnc"></a>

## aeadEnc(nonce, message, secret, [adata]) ⇒ <code>Buffer</code>
Generate symmetric cipher text given a message, secret, and optional auth data

**Kind**: global function  
**Returns**: <code>Buffer</code> - - cipher  

| Param | Type | Description |
| --- | --- | --- |
| nonce | <code>Buffer</code> \| <code>SecBuf</code> | initialization vector |
| message | <code>Buffer</code> \| <code>SecBuf</code> | data to encrypt |
| secret | <code>Buffer</code> \| <code>SecBuf</code> | symmetric secret key |
| [adata] | <code>Buffer</code> \| <code>SecBuf</code> | optional additional authenticated data |

**Example**  
```js
const nonce = await mosodium.random.randomBytes(mosodium.aead.NONCE_BYTES)
const cipher = mosodium.aead.enc(nonce, Buffer.from('hello'), secret, null)
```
<a name="aeadDec"></a>

## aeadDec(message, nonce, cipher, secret, [adata])
Decrypt symmetric cipher text given a nonce, secret, and optional auth data

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>Buffer</code> \| <code>SecBuf</code> | output buffer |
| nonce | <code>Buffer</code> \| <code>SecBuf</code> | sometimes called initialization vector (iv) |
| cipher | <code>Buffer</code> \| <code>SecBuf</code> | the cipher text |
| secret | <code>Buffer</code> \| <code>SecBuf</code> | symmetric secret key |
| [adata] | <code>Buffer</code> \| <code>SecBuf</code> | optional additional authenticated data |

**Example**  
```js
const message = await mosodium.SecBuf.insecure(
  cipher.byteLength - mosodium.aead.A_BYTES)
await mosodium.aead.dec(message, nonce, cipher, secret, null)
```
