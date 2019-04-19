## Functions

<dl>
<dt><a href="#kxKeypair">kxKeypair(publicKey, secretKey)</a></dt>
<dd><p>Generate a fresh, random keyexchange keypair</p>
</dd>
<dt><a href="#kxSeedKeypair">kxSeedKeypair(publicKey, secretKey, seed)</a></dt>
<dd><p>Generate a fresh, keyexchange keypair, based off a seed</p>
</dd>
<dt><a href="#kxClientSession">kxClientSession(rx, tx, cliPublic, cliSecret, srvPublic)</a></dt>
<dd><p>Given a server&#39;s public key, derive shared secrets.</p>
</dd>
<dt><a href="#kxServerSession">kxServerSession(rx, tx, srvPublic, srvSecret, cliPublic)</a></dt>
<dd><p>Given a client&#39;s public key, derive shared secrets.</p>
</dd>
</dl>

<a name="kxKeypair"></a>

## kxKeypair(publicKey, secretKey)
Generate a fresh, random keyexchange keypair

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| publicKey | <code>Buffer</code> | output publicKey |
| secretKey | <code>Buffer</code> | output secretKey |

<a name="kxSeedKeypair"></a>

## kxSeedKeypair(publicKey, secretKey, seed)
Generate a fresh, keyexchange keypair, based off a seed

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| publicKey | <code>Buffer</code> | output publicKey |
| secretKey | <code>Buffer</code> | output secretKey |
| seed | <code>SecBuf</code> | the seed to derive a keypair from |

<a name="kxClientSession"></a>

## kxClientSession(rx, tx, cliPublic, cliSecret, srvPublic)
Given a server's public key, derive shared secrets.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| rx | <code>Buffer</code> | output rx /receive key/ |
| tx | <code>Buffer</code> | output tx /transmit key/ |
| cliPublic | <code>Buffer</code> | client's public key |
| cliSecret | <code>SecBuf</code> | client's secret key |
| srvPublic | <code>Buffer</code> | server's public key |

<a name="kxServerSession"></a>

## kxServerSession(rx, tx, srvPublic, srvSecret, cliPublic)
Given a client's public key, derive shared secrets.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| rx | <code>Buffer</code> | output rx /receive key/ |
| tx | <code>Buffer</code> | output tx /transmit key/ |
| srvPublic | <code>Buffer</code> | server's public key |
| srvSecret | <code>SecBuf</code> | server's secret key |
| cliPublic | <code>Buffer</code> | client's public key |

