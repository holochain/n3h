<a name="Server"></a>

## Server
IPC control api server

**Kind**: global class  

* [Server](#Server)
    * [new Server(bind)](#new_Server_new)
    * [.ready()](#Server+ready) ⇒ <code>Promise</code>
    * [.close()](#Server+close)
    * [.recvSend(fromAddress, data)](#Server+recvSend)
    * [.recvCall(messageId, fromAddress, data)](#Server+recvCall)
    * [.recvCallResp(messageId, fromAddress, data)](#Server+recvCallResp)

<a name="new_Server_new"></a>

### new Server(bind)
Binds to the list of ZeroMq endpoints specified in `bind` argument


| Param | Type | Description |
| --- | --- | --- |
| bind | <code>array.&lt;string&gt;</code> | the array of endpoint to bind |

**Example**  
```js
const IpcServer = require('n3h').ipc.Server
const srv = new IpcServer(['ipc://my-socket.ipc', 'tcp://*:12345'])
```
<a name="Server+ready"></a>

### server.ready() ⇒ <code>Promise</code>
**Kind**: instance method of [<code>Server</code>](#Server)  
**Returns**: <code>Promise</code> - - when we have successfully bound to bind sockets  
<a name="Server+close"></a>

### server.close()
Close all listening sockets, and remove all event listeners.
Do not use this server again, create a new one.

**Kind**: instance method of [<code>Server</code>](#Server)  
<a name="Server+recvSend"></a>

### server.recvSend(fromAddress, data)
We have received a "send" on the p2p network, transmit it to any
listening ipc sockets.

**Kind**: instance method of [<code>Server</code>](#Server)  

| Param | Type | Description |
| --- | --- | --- |
| fromAddress | <code>Buffer</code> | the origin address of the message |
| data | <code>Buffer</code> | the message content |

<a name="Server+recvCall"></a>

### server.recvCall(messageId, fromAddress, data)
We have received a "call" on the p2p network, transmit it to any
listening ipc sockets.

**Kind**: instance method of [<code>Server</code>](#Server)  

| Param | Type | Description |
| --- | --- | --- |
| messageId | <code>Buffer</code> | identifier to correlate the callResp |
| fromAddress | <code>Buffer</code> | the origin address of the message |
| data | <code>Buffer</code> | the message content |

<a name="Server+recvCallResp"></a>

### server.recvCallResp(messageId, fromAddress, data)
We have received a "callResp" on the p2p network, transmit it to any
listening ipc sockets.

**Kind**: instance method of [<code>Server</code>](#Server)  

| Param | Type | Description |
| --- | --- | --- |
| messageId | <code>Buffer</code> | identifier to correlate to our origin call |
| fromAddress | <code>Buffer</code> | the origin address of the message |
| data | <code>Buffer</code> | the message content |

