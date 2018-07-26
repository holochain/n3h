<a name="Client"></a>

## Client
IPC connection client helper

**Kind**: global class  

* [Client](#Client)
    * [new Client(endpoint)](#new_Client_new)
    * [.ready()](#Client+ready) ⇒ <code>Promise</code>
    * [.close()](#Client+close)
    * [.ping()](#Client+ping)
    * [.send(toAddress, data)](#Client+send)
    * [.call(toAddress, data)](#Client+call)
    * [.callResp(messageId, toAddress, data)](#Client+callResp)

<a name="new_Client_new"></a>

### new Client(endpoint)
Connects to a ZeroMQ p2p IPC socket server endpoint.


| Param | Type | Description |
| --- | --- | --- |
| endpoint | <code>string</code> | the endpoint to connect to |

**Example**  
```js
const IpcClient = require('n3h').ipc.Client
const cli = new IpcClient('ipc://my-socket.ipc')
// or
const cli = new IpcClient('tcp://127.0.0.1:12345')
```
<a name="Client+ready"></a>

### client.ready() ⇒ <code>Promise</code>
**Kind**: instance method of [<code>Client</code>](#Client)  
**Returns**: <code>Promise</code> - - when we have successfully established a connection  
<a name="Client+close"></a>

### client.close()
Close the socket, and remove all event listeners.
This client cannot be used again, create a new one.

**Kind**: instance method of [<code>Client</code>](#Client)  
<a name="Client+ping"></a>

### client.ping()
Send an extra ping to the server, you probably don't need to call this.

**Kind**: instance method of [<code>Client</code>](#Client)  
<a name="Client+send"></a>

### client.send(toAddress, data)
Transmit a `send` message over the p2p network

**Kind**: instance method of [<code>Client</code>](#Client)  

| Param | Type | Description |
| --- | --- | --- |
| toAddress | <code>Buffer</code> | the destination p2p node address |
| data | <code>Buffer</code> | the message content |

<a name="Client+call"></a>

### client.call(toAddress, data)
Transmit a `call` message over the p2p network

**Kind**: instance method of [<code>Client</code>](#Client)  

| Param | Type | Description |
| --- | --- | --- |
| toAddress | <code>Buffer</code> | the destination p2p node address |
| data | <code>Buffer</code> | the message content |

<a name="Client+callResp"></a>

### client.callResp(messageId, toAddress, data)
Transmit a `callResp` message over the p2p network

**Kind**: instance method of [<code>Client</code>](#Client)  

| Param | Type | Description |
| --- | --- | --- |
| messageId | <code>Buffer</code> | the origin id sent in the `call` we are responding to |
| toAddress | <code>Buffer</code> | the destination p2p node address |
| data | <code>Buffer</code> | the message content |

