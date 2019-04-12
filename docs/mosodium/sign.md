## Functions

<dl>
<dt><a href="#signSeedKeypair">signSeedKeypair(publicKey, secretKey, seed)</a></dt>
<dd><p>Generate a signing keypair from a seed buffer</p>
</dd>
<dt><a href="#signSign">signSign(signature, message, secretKey)</a></dt>
<dd><p>generate a signature</p>
</dd>
<dt><a href="#signVerify">signVerify(signature, message, publicKey)</a> ⇒ <code>boolean</code></dt>
<dd><p>verify a signature given the message and a publicKey</p>
</dd>
</dl>

<a name="signSeedKeypair"></a>

## signSeedKeypair(publicKey, secretKey, seed)
Generate a signing keypair from a seed buffer

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| publicKey | <code>Buffer</code> | publicKey |
| secretKey | <code>Buffer</code> | secretKey |
| seed | <code>SecBuf</code> | the seed to derive a keypair from |

<a name="signSign"></a>

## signSign(signature, message, secretKey)
generate a signature

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| signature | <code>Buffer</code> | output |
| message | <code>Buffer</code> | the message to sign |
| secretKey | <code>SecBuf</code> | the secret key to sign with |

<a name="signVerify"></a>

## signVerify(signature, message, publicKey) ⇒ <code>boolean</code>
verify a signature given the message and a publicKey

**Kind**: global function  
**Returns**: <code>boolean</code> - True on successful verification  

| Param | Type |
| --- | --- |
| signature | <code>Buffer</code> | 
| message | <code>Buffer</code> | 
| publicKey | <code>Buffer</code> | 

**Example**  
```js
const isGood = mosodium.sign.verify(sig, Buffer.from('hello'), pubKey)
```
