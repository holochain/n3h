## Classes

<dl>
<dt><a href="#Seed">Seed</a></dt>
<dd><p>Superclass of all other seed types</p>
</dd>
<dt><a href="#DevicePinSeed">DevicePinSeed</a></dt>
<dd><p>This is a device seed that has been PIN derived</p>
</dd>
<dt><a href="#DeviceSeed">DeviceSeed</a></dt>
<dd><p>This is a device seed that is waiting for PIN derivation</p>
</dd>
<dt><a href="#RootSeed">RootSeed</a></dt>
<dd><p>This root seed should be pure entropy</p>
</dd>
</dl>

<a name="Seed"></a>

## Seed
Superclass of all other seed types

**Kind**: global class  

* [Seed](#Seed)
    * _instance_
        * [.init(type, seed)](#Seed+init)
        * [.getBlob(passphrase, hint)](#Seed+getBlob)
        * [.getMnemonic()](#Seed+getMnemonic)
    * _static_
        * [.fromBlob(blob, passphrase)](#Seed.fromBlob) ⇒ [<code>RootSeed</code>](#RootSeed) \| [<code>DeviceSeed</code>](#DeviceSeed) \| [<code>DevicePinSeed</code>](#DevicePinSeed)

<a name="Seed+init"></a>

### seed.init(type, seed)
Initialize this seed class with persistence blob type and private seed

**Kind**: instance method of [<code>Seed</code>](#Seed)  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | the persistence blob type |
| seed | <code>SecBuf</code> \| <code>string</code> | the private seed data (as a buffer or mnemonic) |

<a name="Seed+getBlob"></a>

### seed.getBlob(passphrase, hint)
generate a persistence blob with hint info

**Kind**: instance method of [<code>Seed</code>](#Seed)  

| Param | Type | Description |
| --- | --- | --- |
| passphrase | <code>SecBuf</code> | the encryption passphrase |
| hint | <code>string</code> | additional info / description for persistence |

<a name="Seed+getMnemonic"></a>

### seed.getMnemonic()
generate a bip39 mnemonic based on the private seed entropy

**Kind**: instance method of [<code>Seed</code>](#Seed)  
<a name="Seed.fromBlob"></a>

### Seed.fromBlob(blob, passphrase) ⇒ [<code>RootSeed</code>](#RootSeed) \| [<code>DeviceSeed</code>](#DeviceSeed) \| [<code>DevicePinSeed</code>](#DevicePinSeed)
Get the proper seed type from a persistence blob

**Kind**: static method of [<code>Seed</code>](#Seed)  

| Param | Type | Description |
| --- | --- | --- |
| blob | <code>object</code> | the persistence blob |
| passphrase | <code>string</code> | the decryption passphrase |

<a name="DevicePinSeed"></a>

## DevicePinSeed
This is a device seed that has been PIN derived

**Kind**: global class  

* [DevicePinSeed](#DevicePinSeed)
    * [.init()](#DevicePinSeed+init)
    * [.getApplicationKeyBundle(index)](#DevicePinSeed+getApplicationKeyBundle) ⇒ <code>KeyBundle</code>

<a name="DevicePinSeed+init"></a>

### devicePinSeed.init()
delegate to base class

**Kind**: instance method of [<code>DevicePinSeed</code>](#DevicePinSeed)  
<a name="DevicePinSeed+getApplicationKeyBundle"></a>

### devicePinSeed.getApplicationKeyBundle(index) ⇒ <code>KeyBundle</code>
generate an application KeyBundle given an index based on this seed

**Kind**: instance method of [<code>DevicePinSeed</code>](#DevicePinSeed)  

| Param | Type |
| --- | --- |
| index | <code>number</code> | 

<a name="DeviceSeed"></a>

## DeviceSeed
This is a device seed that is waiting for PIN derivation

**Kind**: global class  

* [DeviceSeed](#DeviceSeed)
    * [.init()](#DeviceSeed+init)
    * [.getDevicePinSeed(pin)](#DeviceSeed+getDevicePinSeed) ⇒ [<code>DevicePinSeed</code>](#DevicePinSeed)

<a name="DeviceSeed+init"></a>

### deviceSeed.init()
delegate to base class

**Kind**: instance method of [<code>DeviceSeed</code>](#DeviceSeed)  
<a name="DeviceSeed+getDevicePinSeed"></a>

### deviceSeed.getDevicePinSeed(pin) ⇒ [<code>DevicePinSeed</code>](#DevicePinSeed)
generate a device pin seed by applying pwhash of pin with this seed as the salt

**Kind**: instance method of [<code>DeviceSeed</code>](#DeviceSeed)  

| Param | Type | Description |
| --- | --- | --- |
| pin | <code>string</code> | should be >= 4 characters 1-9 |

<a name="RootSeed"></a>

## RootSeed
This root seed should be pure entropy

**Kind**: global class  

* [RootSeed](#RootSeed)
    * _instance_
        * [.init()](#RootSeed+init)
        * [.getDeviceSeed(index)](#RootSeed+getDeviceSeed) ⇒ [<code>DeviceSeed</code>](#DeviceSeed)
    * _static_
        * [.newRandom()](#RootSeed.newRandom)

<a name="RootSeed+init"></a>

### rootSeed.init()
delegate to base class

**Kind**: instance method of [<code>RootSeed</code>](#RootSeed)  
<a name="RootSeed+getDeviceSeed"></a>

### rootSeed.getDeviceSeed(index) ⇒ [<code>DeviceSeed</code>](#DeviceSeed)
generate a device seed given an index based on this seed

**Kind**: instance method of [<code>RootSeed</code>](#RootSeed)  

| Param | Type |
| --- | --- |
| index | <code>number</code> | 

<a name="RootSeed.newRandom"></a>

### RootSeed.newRandom()
Get a new, completely random root seed

**Kind**: static method of [<code>RootSeed</code>](#RootSeed)  
