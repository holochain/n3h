<a name="IpcClient"></a>

## IpcClient
IPC connection client helper

**Kind**: global class  

* [IpcClient](#IpcClient)
    * [new IpcClient()](#new_IpcClient_new)
    * [.connect(endpoint)](#IpcClient+connect) ⇒ <code>Promise</code>
    * [.ping()](#IpcClient+ping)
    * [.call(data)](#IpcClient+call) ⇒ <code>Buffer</code>

<a name="new_IpcClient_new"></a>

### new IpcClient()
create a new IpcClient instance

**Example**  
```js
const cli = new IpcClient('ipc://my-socket.ipc')
await cli.connect('ipc://my-socket.ipc')
// or
await cli.connect('tcp://127.0.0.1:12345')
```
<a name="IpcClient+connect"></a>

### ipcClient.connect(endpoint) ⇒ <code>Promise</code>
Connect this instance to a server socket

**Kind**: instance method of [<code>IpcClient</code>](#IpcClient)  
**Returns**: <code>Promise</code> - - resolved if connection is a success  

| Param | Type | Description |
| --- | --- | --- |
| endpoint | <code>string</code> | the zmq socket to connect to |

<a name="IpcClient+ping"></a>

### ipcClient.ping()
Send an extra ping to the server, you probably don't need to call this.

**Kind**: instance method of [<code>IpcClient</code>](#IpcClient)  
<a name="IpcClient+call"></a>

### ipcClient.call(data) ⇒ <code>Buffer</code>
Transmit a `call` message to the ipc server

**Kind**: instance method of [<code>IpcClient</code>](#IpcClient)  
**Returns**: <code>Buffer</code> - the response data  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Buffer</code> | the message content |

