<a name="kdfDerive"></a>

## kdfDerive(output, index, context, parent)
Derive a subkey from a parent key

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| output | <code>SecBuf</code> |  |
| index | <code>number</code> | index of subkey to generate |
| context | <code>Buffer</code> | eight bytes context |
| parent | <code>SecBuf</code> | the parent key to derive from |

