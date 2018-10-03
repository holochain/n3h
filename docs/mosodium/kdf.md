<a name="derive"></a>

## derive(index, context, parent, lockLevel) ⇒ <code>SecBuf</code>
Derive a subkey from a parent key

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| index | <code>number</code> | subkey index |
| context | <code>Buffer</code> | eight bytes context |
| parent | <code>SecBuf</code> | the parent key to derive from |
| lockLevel | <code>string</code> | the SecBuf.LOCK_* level of output SecBuf |

**Example**  
```js
const subkey = mosodium.kdf.derive(1, Buffer.from('eightchr'), pk)
```
