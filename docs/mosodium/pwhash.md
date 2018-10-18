<a name="hash"></a>

## hash(password, opts) ⇒ <code>object</code>
Calculate a password hash

**Kind**: global function  
**Returns**: <code>object</code> - - { salt / the salt used /, hash / the hash generated / }  

| Param | Type | Description |
| --- | --- | --- |
| password | <code>SecBuf</code> | the password to hash |
| opts | <code>object</code> |  |
| opts.opslimit | <code>number</code> | operation scaling for hashing algorithm |
| opts.memlimit | <code>number</code> | memory scaling for hashing algorithm |
| opts.algorithm | <code>number</code> | which hashing algorithm |
| [opts.salt] | <code>Buffer</code> | predefined salt (random if not included) |

**Example**  
```js
const { salt, hash } = mosodium.pwhash.hash(passphrase)
```
**Example**  
```js
const { salt, hash } = mosodium.pwhash.hash(passphrase, {
  opslimit: mosodium.pwhash.OPSLIMIT_MODERATE,
  memlimit: mosodium.pwhash.MEMLIMIT_MODERATE,
  salt: mysalt
})
```
