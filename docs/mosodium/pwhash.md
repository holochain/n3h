<a name="pwhash"></a>

## pwhash(output, password, [salt], opts)
Calculate a password hash

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| output | <code>SecBuf</code> | output of the hashed password |
| password | <code>SecBuf</code> | the password to hash |
| [salt] | <code>SecBuf</code> | predefined salt (random if not included) |
| opts | <code>object</code> |  |
| opts.opslimit | <code>number</code> | operation scaling for hashing algorithm |
| opts.memlimit | <code>number</code> | memory scaling for hashing algorithm |
| opts.algorithm | <code>number</code> | which hashing algorithm |

