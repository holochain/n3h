## Functions

<dl>
<dt><a href="#keypair">keypair()</a> ⇒ <code>object</code></dt>
<dd><p>Generate a fresh, random keyexchange keypair</p>
</dd>
<dt><a href="#seedKeypair">seedKeypair(seed)</a> ⇒ <code>object</code></dt>
<dd><p>Generate a fresh, keyexchange keypair, based off a seed</p>
</dd>
<dt><a href="#clientSession">clientSession(cliPublic, cliSecret, srvPublic)</a> ⇒ <code>object</code></dt>
<dd><p>Given a server&#39;s public key, derive shared secrets.</p>
</dd>
<dt><a href="#serverSession">serverSession(srvPublic, srvSecret, cliPublic)</a> ⇒ <code>object</code></dt>
<dd><p>Given a client&#39;s public key, derive shared secrets.</p>
</dd>
</dl>

<a name="keypair"></a>

## keypair() ⇒ <code>object</code>
Generate a fresh, random keyexchange keypair

**Kind**: global function  
**Returns**: <code>object</code> - { publicKey, secretKey }  
**Example**  
```js
const { publicKey, secretKey } = mosodium.kx.keypair()
```
<a name="seedKeypair"></a>

## seedKeypair(seed) ⇒ <code>object</code>
Generate a fresh, keyexchange keypair, based off a seed

**Kind**: global function  
**Returns**: <code>object</code> - { publicKey, secretKey }  

| Param | Type | Description |
| --- | --- | --- |
| seed | <code>SecBuf</code> | the seed to derive a keypair from |

**Example**  
```js
const { publicKey, secretKey } = mosodium.kx.seedKeypair(seed)
```
<a name="clientSession"></a>

## clientSession(cliPublic, cliSecret, srvPublic) ⇒ <code>object</code>
Given a server's public key, derive shared secrets.

**Kind**: global function  
**Returns**: <code>object</code> - { rx /receive key/, tx /transmit key/ }  

| Param | Type | Description |
| --- | --- | --- |
| cliPublic | <code>Buffer</code> | client's public key |
| cliSecret | <code>SecBuf</code> | client's secret key |
| srvPublic | <code>Buffer</code> | server's public key |

**Example**  
```js
const { rx, tx } = mosodium.kx.clientSession(cliPub, cliSec, srvPub)
```
<a name="serverSession"></a>

## serverSession(srvPublic, srvSecret, cliPublic) ⇒ <code>object</code>
Given a client's public key, derive shared secrets.

**Kind**: global function  
**Returns**: <code>object</code> - { rx /receive key/, tx /transmit key/ }  

| Param | Type | Description |
| --- | --- | --- |
| srvPublic | <code>Buffer</code> | server's public key |
| srvSecret | <code>SecBuf</code> | server's secret key |
| cliPublic | <code>Buffer</code> | client's public key |

**Example**  
```js
const { rx, tx } = mosodium.kx.serverSession(srvPub, srvSec, cliPub)
```
