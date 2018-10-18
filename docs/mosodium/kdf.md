<a name="derive"></a>

## derive(index, context, parent) ⇒ <code>SecBuf</code>
Derive a subkey from a parent key

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| index | <code>number</code> | subkey index |
| context | <code>Buffer</code> | eight bytes context |
| parent | <code>SecBuf</code> | the parent key to derive from |

**Example**  
```js
const subkey = mosodium.kdf.derive(1, Buffer.from('eightchr'), pk)
```
