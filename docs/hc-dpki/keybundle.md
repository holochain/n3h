<a name="KeyBundle"></a>

## KeyBundle
Represents two asymmetric cryptography keypairs
- a signing keypair
- an encryption keypair

base32 encoded identity string (hcid) to represent the public sides

can optionally be initialized without the private halves of the pairs

**Kind**: global class  

* [KeyBundle](#KeyBundle)
    * _instance_
        * [.init(opt)](#KeyBundle+init)
        * [.getBlob(passphrase, hint)](#KeyBundle+getBlob) ⇒ <code>Buffer</code>
        * [.getId()](#KeyBundle+getId) ⇒ <code>string</code>
        * [.getEncId()](#KeyBundle+getEncId) ⇒ <code>string</code>
        * [.sign(data)](#KeyBundle+sign) ⇒ <code>SecBuf</code>
        * [.verify()](#KeyBundle+verify)
    * _static_
        * [.newFromSeed(seed)](#KeyBundle.newFromSeed) ⇒ [<code>KeyBundle</code>](#KeyBundle)
        * [.fromBlob(blob, passphrase)](#KeyBundle.fromBlob) ⇒ [<code>KeyBundle</code>](#KeyBundle)

<a name="KeyBundle+init"></a>

### keyBundle.init(opt)
KeyBundle constructor (you probably want one of the static functions above)

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)  

| Param | Type | Description |
| --- | --- | --- |
| opt | <code>object</code> |  |
| opt.signPubId | <code>string</code> | the signing identity string |
| [opt.encPubId] | <code>string</code> | the encrypting identity string |
| [opt.signPriv] | <code>SecBuf</code> | private signature key |
| [opt.encPriv] | <code>SecBuf</code> | private encryption key |

<a name="KeyBundle+getBlob"></a>

### keyBundle.getBlob(passphrase, hint) ⇒ <code>Buffer</code>
generate an encrypted persistence blob of the keyBundle

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)  
**Returns**: <code>Buffer</code> - Object holding encrypted KeyBundle  

| Param | Type | Description |
| --- | --- | --- |
| passphrase | <code>string</code> | the encryption passphrase |
| hint | <code>string</code> | additional info / description for the blob |

<a name="KeyBundle+getId"></a>

### keyBundle.getId() ⇒ <code>string</code>
get the identifier string

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)  
<a name="KeyBundle+getEncId"></a>

### keyBundle.getEncId() ⇒ <code>string</code>
get the identifier string

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)  
<a name="KeyBundle+sign"></a>

### keyBundle.sign(data) ⇒ <code>SecBuf</code>
sign some data with the signing private key

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)  
**Returns**: <code>SecBuf</code> - signature  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Buffer</code> | the data to sign |

<a name="KeyBundle+verify"></a>

### keyBundle.verify()
Return true if data was signed with our private signing key

**Kind**: instance method of [<code>KeyBundle</code>](#KeyBundle)  
<a name="KeyBundle.newFromSeed"></a>

### KeyBundle.newFromSeed(seed) ⇒ [<code>KeyBundle</code>](#KeyBundle)
derive the keyBundle from a 32 byte seed buffer

**Kind**: static method of [<code>KeyBundle</code>](#KeyBundle)  

| Param | Type | Description |
| --- | --- | --- |
| seed | <code>SecBuf</code> | the seed buffer |

<a name="KeyBundle.fromBlob"></a>

### KeyBundle.fromBlob(blob, passphrase) ⇒ [<code>KeyBundle</code>](#KeyBundle)
initialize the keyBundle from an encrypted persistence blob

**Kind**: static method of [<code>KeyBundle</code>](#KeyBundle)  

| Param | Type | Description |
| --- | --- | --- |
| blob | <code>object</code> | persistence info |
| passphrase | <code>string</code> | decryption passphrase |

