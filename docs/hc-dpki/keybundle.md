<a name="KeyBundle"></a>

## KeyBundle
Represents two asymmetric cryptography keypairs
- a signing keypair
- an encryption keypair

Public keys are encoded with HCID.
The signing public key acts as the identity string.

KeyBundle can optionally be initialized without the private halves of the pairs, and without the encryption keypair.

**Kind**: global class

* [KeyBundle](#KeyBundle)
    * _instance_
        * [.init(opt)](#KeyBundle+init)
        * [.getBlob(passphrase, hint)](#KeyBundle+getBlob)
        * [.getId()](#KeyBundle+getId) ⇒ <code>string</code>
        * [.sign(data)](#KeyBundle+sign)
        * [.verify(signature, data)](#KeyBundle+verify)
        * [.encrypt(recipientIds, data)](#KeyBundle+encrypt) ⇒ <code>Buffer</code>
        * [.decrypt(sourceId, cipher)](#KeyBundle+decrypt) ⇒ <code>Buffer</code>
    * _static_
        * [.newFromSeed(seed)](#KeyBundle.newFromSeed)
        * [.fromBlob(blob, passphrase)](#KeyBundle.fromBlob)

<a name="KeyBundle+init"></a>

### KeyBundle.init(opt)
KeyBundle constructor (you probably want one of the static functions above)

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)

| Param | Type | Description |
| --- | --- | --- |
| opt | <code>object</code> |  |
| opt.signPubId | <code>string</code> | HCID encoded public signature key |
| [opt.encPubId] | <code>string</code> | HCID encoded public encryption key |
| [opt.signPriv] | <code>SecBuf</code> | private signature key |
| [opt.encPriv] | <code>SecBuf</code> | private encryption key |

<a name="Keypair+getBundle"></a>

### KeyBundle.getBundle(passphrase, hint)
generate an encrypted persistence bundle

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)

| Param | Type | Description |
| --- | --- | --- |
| passphrase | <code>string</code> | the encryption passphrase |
| hint | <code>string</code> | additional info / description for the bundle |

<a name="KeyBundle+getId"></a>

### KeyBundle.getId() ⇒ <code>string</code>
get the KeyBundle identifier string (the public signing key).

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)
<a name="KeyBundle+sign"></a>

### KeyBundle.sign(data)
sign some arbitrary data with the signing private key

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Buffer</code> | the data to sign |

<a name="Keypair+verify"></a>

### KeyBundle.verify(signature, data)
verify data that was signed with our private signing key

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)

| Param | Type |
| --- | --- |
| signature | <code>Buffer</code> |
| data | <code>Buffer</code> |

<a name="Keypair+encrypt"></a>

### KeyBundle.encrypt(recipientIds, data) ⇒ <code>Buffer</code>
encrypt arbitrary data to be readale by potentially multiple recipients

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)

| Param | Type | Description |
| --- | --- | --- |
| recipientIds | <code>array.&lt;string&gt;</code> | multiple recipient identifier strings |
| data | <code>Buffer</code> | the data to encrypt |

<a name="KeyBundle+decrypt"></a>

### KeyBundle.decrypt(sourceId, cipher) ⇒ <code>Buffer</code>
attempt to decrypt the cipher buffer (assuming it was targeting us)

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)
**Returns**: <code>Buffer</code> - - the decrypted data

| Param | Type | Description |
| --- | --- | --- |
| sourceId | <code>string</code> | identifier string of who encrypted this data |
| cipher | <code>Buffer</code> | the encrypted data |

<a name="Keypair.newFromSeed"></a>

### KeyBundle.newFromSeed(seed)
derive the pairs from a 32 byte seed buffer

**Kind**: static method of [<code>KeyBundle</code>](#KeyBundle)

| Param | Type | Description |
| --- | --- | --- |
| seed | <code>SecBuf</code> | the seed buffer |

<a name="KeyBundle.fromBundle"></a>

### KeyBundle.fromBlob(blob, passphrase)
initialize the pairs from an encrypted persistence blob

**Kind**: static method of [<code>KeyBundle</code>](#KeyBundle)

| Param | Type | Description |
| --- | --- | --- |
| blob | <code>object</code> | persistence info |
| passphrase | <code>string</code> | decryption passphrase |

