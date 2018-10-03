## Functions

<dl>
<dt><a href="#seedKeypair">seedKeypair(seed, lockLevel)</a></dt>
<dd><p>Generate a signing keypair from a seed buffer</p>
</dd>
<dt><a href="#sign">sign(message, secretKey)</a> ⇒ <code>Buffer</code></dt>
<dd><p>generate a signature</p>
</dd>
<dt><a href="#verify">verify(signature, message, publicKey)</a></dt>
<dd><p>verify a signature given the message and a publicKey</p>
</dd>
</dl>

<a name="seedKeypair"></a>

## seedKeypair(seed, lockLevel)
Generate a signing keypair from a seed buffer

**Kind**: global function  
**Retun**: <code>object</code> - { publicKey, privateKey }  

| Param | Type | Description |
| --- | --- | --- |
| seed | <code>SecBuf</code> | the seed to derive a keypair from |
| lockLevel | <code>string</code> | the SecBuf.LOCK_* level of output SecBuf |

**Example**  
```js
const { publicKey, secretKey } = mosodium.sign.seedKeypair(seed)
```
<a name="sign"></a>

## sign(message, secretKey) ⇒ <code>Buffer</code>
generate a signature

**Kind**: global function  
**Returns**: <code>Buffer</code> - signature data  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>Buffer</code> | the message to sign |
| secretKey | <code>SecBuf</code> | the secret key to sign with |

**Example**  
```js
const sig = mosodium.sign.sign(Buffer.from('hello'), secretKey)
```
<a name="verify"></a>

## verify(signature, message, publicKey)
verify a signature given the message and a publicKey

**Kind**: global function  

| Param | Type |
| --- | --- |
| signature | <code>Buffer</code> | 
| message | <code>Buffer</code> | 
| publicKey | <code>Buffer</code> | 

**Example**  
```js
const isGood = mosodium.sign.verify(sig, Buffer.from('hello'), pubKey)
```
